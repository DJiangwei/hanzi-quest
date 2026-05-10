'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { generateWeekContent, regenerateCharacter } from '@/lib/ai/generate-content';
import { assertParent, requireChild } from '@/lib/auth/guards';
import {
  linkWeekCharacters,
  replaceCharacterSentence,
  replaceCharacterWords,
  upsertSimplifiedCharacter,
  getCharacterOwnedByWeek,
} from '@/lib/db/characters';
import { db } from '@/db';
import { ensureSchoolCustomPack } from '@/lib/db/curriculum';
import {
  createWeek,
  getWeekOwnedBy,
  listCharactersForWeek,
  listWeeksByChild,
  setWeekStatus,
} from '@/lib/db/weeks';
import { extractHanzi } from '@/lib/hanzi/extract';

export type CreateWeekState = { error?: string; weekId?: string };
export type CreateStageState = { error?: string; createdCount?: number };

const CreateWeekSchema = z.object({
  childId: z.string().uuid('Pick a child'),
  label: z.string().trim().min(1).max(80),
  rawChars: z.string().min(1),
});

export async function createWeekAction(
  _prev: CreateWeekState,
  formData: FormData,
): Promise<CreateWeekState> {
  const parsed = CreateWeekSchema.safeParse({
    childId: formData.get('childId'),
    label: formData.get('label'),
    rawChars: formData.get('rawChars'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const characters = extractHanzi(parsed.data.rawChars);
  if (characters.length < 1 || characters.length > 12) {
    return {
      error: `Found ${characters.length} unique Chinese characters; need 1–12.`,
    };
  }

  const { parent, child } = await requireChild(parsed.data.childId);

  const packId =
    child.currentCurriculumPackId ?? (await ensureSchoolCustomPack(parent.id));

  const week = await createWeek({
    parentUserId: parent.id,
    childId: child.id,
    curriculumPackId: packId,
    label: parsed.data.label,
  });

  try {
    await generateWeekContent({
      weekId: week.id,
      parentUserId: parent.id,
      childAge: child.birthYear
        ? new Date().getFullYear() - child.birthYear
        : null,
      weekLabel: parsed.data.label,
      characters,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `AI generation failed: ${message}. The week was saved as a draft so you can retry.`,
      weekId: week.id,
    };
  }

  revalidatePath('/parent');
  revalidatePath('/parent/week/new');
  redirect(`/parent/week/${week.id}/review`);
}

export async function regenerateCharacterAction(
  weekId: string,
  characterId: string,
): Promise<{ error?: string }> {
  const parent = await assertParent();
  const week = await getWeekOwnedBy(weekId, parent.id);
  if (!week) return { error: 'Week not found' };

  const character = await getCharacterOwnedByWeek(characterId, weekId);
  if (!character) return { error: 'Character not in this week' };

  try {
    await regenerateCharacter({
      weekId,
      parentUserId: parent.id,
      characterId,
      hanzi: character.hanzi,
      childAge: null,
      weekLabel: week.label,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  revalidatePath(`/parent/week/${weekId}/review`);
  return {};
}

const SaveCharacterEditsSchema = z.object({
  pinyin: z.string().trim().min(1),
  meaningEn: z.string().trim().min(1).max(80),
  meaningZh: z.string().trim().min(1).max(40),
  word1: z.string().trim().min(1).max(8),
  word1Pinyin: z.string().trim().min(1),
  word1Meaning: z.string().trim().min(1).max(80),
  word2: z.string().trim().min(1).max(8),
  word2Pinyin: z.string().trim().min(1),
  word2Meaning: z.string().trim().min(1).max(80),
  word3: z.string().trim().min(1).max(8),
  word3Pinyin: z.string().trim().min(1),
  word3Meaning: z.string().trim().min(1).max(80),
  sentence: z.string().trim().min(2).max(40),
  sentencePinyin: z.string().trim().min(1),
  sentenceMeaning: z.string().trim().min(1).max(120),
});

function splitPinyin(s: string): string[] {
  return s
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function saveCharacterEditsAction(
  weekId: string,
  characterId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const parent = await assertParent();
  const week = await getWeekOwnedBy(weekId, parent.id);
  if (!week) return { error: 'Week not found' };

  const character = await getCharacterOwnedByWeek(characterId, weekId);
  if (!character) return { error: 'Character not in this week' };

  const parsed = SaveCharacterEditsSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const v = parsed.data;

  await db.transaction(async (tx) => {
    await upsertSimplifiedCharacter(tx, {
      hanzi: character.hanzi,
      pinyinArray: splitPinyin(v.pinyin),
      meaningEn: v.meaningEn,
      meaningZh: v.meaningZh,
      createdByUserId: parent.id,
    });
    await replaceCharacterWords(tx, characterId, [
      {
        text: v.word1,
        pinyinArray: splitPinyin(v.word1Pinyin),
        meaningEn: v.word1Meaning,
      },
      {
        text: v.word2,
        pinyinArray: splitPinyin(v.word2Pinyin),
        meaningEn: v.word2Meaning,
      },
      {
        text: v.word3,
        pinyinArray: splitPinyin(v.word3Pinyin),
        meaningEn: v.word3Meaning,
      },
    ]);
    await replaceCharacterSentence(tx, characterId, {
      text: v.sentence,
      pinyinArray: splitPinyin(v.sentencePinyin),
      meaningEn: v.sentenceMeaning,
    });
  });

  revalidatePath(`/parent/week/${weekId}/review`);
  return {};
}

export async function listChildWeeks(childId: string) {
  const { child } = await requireChild(childId);
  return listWeeksByChild(child.id);
}

const CreateStageSchema = z.object({
  childId: z.string().uuid('Pick a child'),
  labelPrefix: z.string().trim().min(1).max(40),
  rawText: z.string().min(1),
});

interface ParsedLesson {
  index: number;
  characters: string[];
}

function parseStageText(raw: string): ParsedLesson[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line, idx) => ({
      index: idx + 1,
      characters: extractHanzi(line),
    }));
}

/**
 * Bulk-create N draft weeks from a paste-multiline textarea (one lesson per
 * non-empty line). No AI is invoked; each week lands in 'draft' with its
 * characters stored in `week_characters`. Use generateWeekAction to fill in
 * the AI content per week.
 */
export async function createStageAction(
  _prev: CreateStageState,
  formData: FormData,
): Promise<CreateStageState> {
  const parsed = CreateStageSchema.safeParse({
    childId: formData.get('childId'),
    labelPrefix: (formData.get('labelPrefix') as string | null) || 'Lesson',
    rawText: formData.get('rawText'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lessons = parseStageText(parsed.data.rawText);
  if (lessons.length === 0) {
    return { error: 'No non-empty lines found in the textarea.' };
  }
  const bad = lessons.find(
    (l) => l.characters.length < 1 || l.characters.length > 12,
  );
  if (bad) {
    return {
      error: `Line ${bad.index} has ${bad.characters.length} unique Chinese characters; each line must have 1–12.`,
    };
  }

  const { parent, child } = await requireChild(parsed.data.childId);
  const packId =
    child.currentCurriculumPackId ?? (await ensureSchoolCustomPack(parent.id));

  for (const lesson of lessons) {
    const week = await createWeek({
      parentUserId: parent.id,
      childId: child.id,
      curriculumPackId: packId,
      label: `${parsed.data.labelPrefix} ${lesson.index}`,
      status: 'draft',
    });

    await db.transaction(async (tx) => {
      const pairs: Array<{ characterId: string; position: number }> = [];
      for (let i = 0; i < lesson.characters.length; i++) {
        const charRow = await upsertSimplifiedCharacter(tx, {
          hanzi: lesson.characters[i],
          pinyinArray: [],
          createdByUserId: parent.id,
        });
        pairs.push({ characterId: charRow.id, position: i });
      }
      await linkWeekCharacters(tx, week.id, pairs);
    });
  }

  revalidatePath('/parent');
  redirect('/parent');
}

/**
 * Run AI generation on an existing draft week's stored characters. Flips
 * draft → ai_generating during the call; generateWeekContent flips it to
 * awaiting_review on success or back to draft on failure.
 */
export async function generateWeekAction(
  weekId: string,
): Promise<{ error?: string }> {
  const parent = await assertParent();
  const week = await getWeekOwnedBy(weekId, parent.id);
  if (!week) return { error: 'Week not found' };

  const stored = await listCharactersForWeek(weekId);
  if (stored.length === 0) {
    return { error: 'This week has no stored characters yet.' };
  }
  const characters = stored.map((s) => s.character.hanzi);

  await setWeekStatus(weekId, 'ai_generating');
  try {
    await generateWeekContent({
      weekId,
      parentUserId: parent.id,
      childAge: null,
      weekLabel: week.label,
      characters,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath('/parent');
  revalidatePath(`/parent/week/${weekId}/review`);
  redirect(`/parent/week/${weekId}/review`);
}
