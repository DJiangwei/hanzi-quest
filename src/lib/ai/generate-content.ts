import { deepseek } from '@ai-sdk/deepseek';
import { generateObject } from 'ai';
import { db } from '@/db';
import { completeJob, createJob, failJob } from '@/lib/db/ai-jobs';
import {
  getCharacterOwnedByWeek,
  linkWeekCharacters,
  replaceCharacterSentence,
  replaceCharacterWords,
  upsertSimplifiedCharacter,
} from '@/lib/db/characters';
import { setWeekStatus } from '@/lib/db/weeks';
import {
  GENERATE_WEEK_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserPrompt,
} from './prompts/generate-week-v1';
import {
  PerCharacterSchema,
  WeekContentSchemaV1,
  type WeekContent,
} from './schemas';

// DeepSeek V4 Pro: Chinese-native, ~10x cheaper than Sonnet for this workload,
// and produces equivalent quality on this prompt (verified 2026-05-10 with
// scripts/preview-week-gen.ts on the school's Lesson 1).
const MODEL_ID = 'deepseek-v4-pro';
const MODEL_LABEL = `deepseek/${MODEL_ID}`;
const model = deepseek(MODEL_ID);

interface GenerateWeekInput {
  weekId: string;
  /** null when generating shared/curated content (no owning parent) */
  parentUserId: string | null;
  childAge: number | null;
  weekLabel: string;
  characters: string[];
}

/**
 * Generates content for every character in a week, persists it, and flips
 * the week from `ai_generating` → `awaiting_review`.
 *
 * Synchronous: callers (server actions) await this; total wall time is
 * 20–60s for 10 chars.
 */
export async function generateWeekContent(
  input: GenerateWeekInput,
): Promise<{ jobId: string; content: WeekContent }> {
  const job = await createJob({
    kind: 'generate_week',
    inputJson: {
      promptVersion: PROMPT_VERSION,
      weekId: input.weekId,
      characters: input.characters,
      childAge: input.childAge,
    },
    model: MODEL_LABEL,
  });

  try {
    const result = await generateObject({
      model,
      schema: WeekContentSchemaV1,
      schemaName: 'WeekContent',
      schemaDescription:
        'Per-character pinyin, three example words, one example sentence, and an image hook for a weekly batch of Chinese characters.',
      system: GENERATE_WEEK_SYSTEM_PROMPT,
      prompt: buildUserPrompt({
        characters: input.characters,
        childAge: input.childAge,
        weekLabel: input.weekLabel,
      }),
      temperature: 0.4,
    });

    const content = result.object;

    if (content.perCharacter.length !== input.characters.length) {
      throw new Error(
        `AI returned ${content.perCharacter.length} entries but expected ${input.characters.length}`,
      );
    }

    await persistWeekContent({
      weekId: input.weekId,
      parentUserId: input.parentUserId,
      content,
    });

    await setWeekStatus(input.weekId, 'awaiting_review');

    await completeJob(job.id, {
      output: content,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
    });

    return { jobId: job.id, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    await setWeekStatus(input.weekId, 'draft');
    throw err;
  }
}

async function persistWeekContent(args: {
  weekId: string;
  parentUserId: string | null;
  content: WeekContent;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const linkPairs: Array<{ characterId: string; position: number }> = [];

    for (let i = 0; i < args.content.perCharacter.length; i++) {
      const c = args.content.perCharacter[i];
      const charRow = await upsertSimplifiedCharacter(tx, {
        hanzi: c.hanzi,
        pinyinArray: c.pinyin,
        meaningEn: c.meaningEn,
        meaningZh: c.meaningZh,
        imageHook: c.imageHook,
        createdByUserId: args.parentUserId,
      });

      await replaceCharacterWords(
        tx,
        charRow.id,
        c.words.map((w) => ({
          text: w.word,
          pinyinArray: w.pinyin,
          meaningEn: w.meaningEn,
        })),
      );

      await replaceCharacterSentence(tx, charRow.id, {
        text: c.sentence.text,
        pinyinArray: c.sentence.pinyin,
        meaningEn: c.sentence.meaningEn,
      });

      linkPairs.push({ characterId: charRow.id, position: i });
    }

    await linkWeekCharacters(tx, args.weekId, linkPairs);
  });
}

interface RegenerateCharacterInput {
  weekId: string;
  parentUserId: string;
  characterId: string;
  hanzi: string;
  childAge: number | null;
  weekLabel: string;
}

/**
 * Regenerate just one character's content (called from the review page).
 */
export async function regenerateCharacter(
  input: RegenerateCharacterInput,
): Promise<{ jobId: string }> {
  // Confirm the character actually belongs to this week.
  const owned = await getCharacterOwnedByWeek(input.characterId, input.weekId);
  if (!owned) throw new Error('Character does not belong to this week');

  const job = await createJob({
    kind: 'regenerate_char',
    inputJson: {
      promptVersion: PROMPT_VERSION,
      characterId: input.characterId,
      hanzi: input.hanzi,
    },
    model: MODEL_LABEL,
  });

  try {
    const result = await generateObject({
      model,
      schema: PerCharacterSchema,
      schemaName: 'PerCharacter',
      schemaDescription:
        'Pinyin, 3 words, 1 sentence, image hook for one Chinese character.',
      system: GENERATE_WEEK_SYSTEM_PROMPT,
      prompt: buildUserPrompt({
        characters: [input.hanzi],
        childAge: input.childAge,
        weekLabel: input.weekLabel,
      }).concat(
        '\nProduce content ONLY for this single character. Output the inner per-character object directly (not wrapped in perCharacter[]).',
      ),
      temperature: 0.5,
    });

    const c = result.object;

    await db.transaction(async (tx) => {
      await upsertSimplifiedCharacter(tx, {
        hanzi: c.hanzi,
        pinyinArray: c.pinyin,
        meaningEn: c.meaningEn,
        meaningZh: c.meaningZh,
        imageHook: c.imageHook,
        createdByUserId: input.parentUserId,
      });

      await replaceCharacterWords(
        tx,
        input.characterId,
        c.words.map((w) => ({
          text: w.word,
          pinyinArray: w.pinyin,
          meaningEn: w.meaningEn,
        })),
      );

      await replaceCharacterSentence(tx, input.characterId, {
        text: c.sentence.text,
        pinyinArray: c.sentence.pinyin,
        meaningEn: c.sentence.meaningEn,
      });
    });

    await completeJob(job.id, {
      output: c,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
    });

    return { jobId: job.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    throw err;
  }
}
