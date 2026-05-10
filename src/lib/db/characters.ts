import { and, eq, inArray } from 'drizzle-orm';
import { db, type DB } from '@/db';
import {
  characterSentence,
  characterWord,
  characters,
  exampleSentences,
  weekCharacters,
  words,
} from '@/db/schema';

export type CharacterRow = typeof characters.$inferSelect;
export type WordRow = typeof words.$inferSelect;
export type SentenceRow = typeof exampleSentences.$inferSelect;

type Tx = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface UpsertCharacterInput {
  hanzi: string;
  pinyinArray: string[];
  meaningEn?: string | null;
  meaningZh?: string | null;
  imageHook?: string | null;
  createdByUserId: string;
}

/**
 * Idempotent upsert keyed on (hanzi, script='simplified').
 * Returns the row id; updates the meaning/pinyin fields if a row already exists.
 */
export async function upsertSimplifiedCharacter(
  tx: Tx,
  input: UpsertCharacterInput,
): Promise<CharacterRow> {
  const [row] = await tx
    .insert(characters)
    .values({
      hanzi: input.hanzi,
      script: 'simplified',
      pinyinArray: input.pinyinArray,
      meaningEn: input.meaningEn ?? null,
      meaningZh: input.meaningZh ?? null,
      imageHook: input.imageHook ?? null,
      source: 'ai_generated',
      createdByUserId: input.createdByUserId,
    })
    .onConflictDoUpdate({
      target: [characters.hanzi, characters.script],
      set: {
        pinyinArray: input.pinyinArray,
        meaningEn: input.meaningEn ?? null,
        meaningZh: input.meaningZh ?? null,
        imageHook: input.imageHook ?? null,
      },
    })
    .returning();
  return row;
}

export async function replaceCharacterWords(
  tx: Tx,
  characterId: string,
  inputs: Array<{
    text: string;
    pinyinArray: string[];
    meaningEn: string;
  }>,
): Promise<WordRow[]> {
  // Drop prior links for this character (we do not delete the words themselves
  // because they may be linked from other characters).
  await tx
    .delete(characterWord)
    .where(eq(characterWord.characterId, characterId));

  const created: WordRow[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const w = inputs[i];
    const [wordRow] = await tx
      .insert(words)
      .values({
        text: w.text,
        script: 'simplified',
        pinyinArray: w.pinyinArray,
        meaningEn: w.meaningEn,
      })
      .returning();
    await tx
      .insert(characterWord)
      .values({
        characterId,
        wordId: wordRow.id,
        position: i,
      })
      .onConflictDoNothing();
    created.push(wordRow);
  }
  return created;
}

export async function replaceCharacterSentence(
  tx: Tx,
  characterId: string,
  input: { text: string; pinyinArray: string[]; meaningEn: string },
): Promise<SentenceRow> {
  await tx
    .delete(characterSentence)
    .where(eq(characterSentence.characterId, characterId));

  const [sentenceRow] = await tx
    .insert(exampleSentences)
    .values({
      text: input.text,
      pinyinArray: input.pinyinArray,
      meaningEn: input.meaningEn,
    })
    .returning();

  await tx.insert(characterSentence).values({
    characterId,
    sentenceId: sentenceRow.id,
  });
  return sentenceRow;
}

export async function linkWeekCharacters(
  tx: Tx,
  weekId: string,
  pairs: Array<{ characterId: string; position: number }>,
): Promise<void> {
  if (!pairs.length) return;
  // Replace any existing links for this week.
  await tx.delete(weekCharacters).where(eq(weekCharacters.weekId, weekId));
  await tx.insert(weekCharacters).values(
    pairs.map(({ characterId, position }) => ({
      weekId,
      characterId,
      position,
    })),
  );
}

export interface CharacterWithDetails extends CharacterRow {
  words: WordRow[];
  sentence: SentenceRow | null;
}

export async function getCharactersWithDetailsForWeek(
  weekId: string,
): Promise<CharacterWithDetails[]> {
  const charPairs = await db
    .select({
      character: characters,
      position: weekCharacters.position,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(eq(weekCharacters.weekId, weekId))
    .orderBy(weekCharacters.position);

  if (!charPairs.length) return [];

  const charIds = charPairs.map((c) => c.character.id);

  const wordRows = await db
    .select({
      characterId: characterWord.characterId,
      position: characterWord.position,
      word: words,
    })
    .from(characterWord)
    .innerJoin(words, eq(words.id, characterWord.wordId))
    .where(inArray(characterWord.characterId, charIds));

  const sentenceRows = await db
    .select({
      characterId: characterSentence.characterId,
      sentence: exampleSentences,
    })
    .from(characterSentence)
    .innerJoin(
      exampleSentences,
      eq(exampleSentences.id, characterSentence.sentenceId),
    )
    .where(inArray(characterSentence.characterId, charIds));

  const wordsByChar = new Map<string, WordRow[]>();
  for (const r of wordRows) {
    const list = wordsByChar.get(r.characterId) ?? [];
    list.push(r.word);
    wordsByChar.set(r.characterId, list);
  }
  const sentenceByChar = new Map<string, SentenceRow>();
  for (const r of sentenceRows) {
    sentenceByChar.set(r.characterId, r.sentence);
  }

  return charPairs.map(({ character }) => ({
    ...character,
    words: wordsByChar.get(character.id) ?? [],
    sentence: sentenceByChar.get(character.id) ?? null,
  }));
}

export async function getCharacterOwnedByWeek(
  characterId: string,
  weekId: string,
): Promise<CharacterRow | undefined> {
  const [row] = await db
    .select({ c: characters })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(
      and(
        eq(weekCharacters.weekId, weekId),
        eq(weekCharacters.characterId, characterId),
      ),
    )
    .limit(1);
  return row?.c;
}
