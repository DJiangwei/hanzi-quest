'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireChild } from '@/lib/auth/guards';
import { generateStoryChapterWithAI } from '@/lib/ai/deepseek-story';
import { resolveNarrativeHint } from '@/lib/avatar/itemCatalog';
import { getEquippedAvatar } from '@/lib/db/shop';
import { getEquippedPet } from '@/lib/db/pets';
import {
  getCharactersAvailableForChildWeek,
  getLatestBossScoreForChildWeek,
  getStoryChapterByWeek,
  listStoryChaptersForChild,
  markChapterRead,
  upsertStoryChapter,
  type StoryChapterRow,
  type StoryTone,
} from '@/lib/db/story';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { pullCardForChild } from '@/lib/play/card-grants';

const GenerateInputSchema = z.object({
  childId: z.string(),
  weekId: z.string(),
});

function toneFromScore(scorePct: number): StoryTone {
  if (scorePct >= 95) return 'triumphant';
  if (scorePct < 67) return 'narrow_escape';
  return 'standard';
}

async function buildHeroAppearance(childId: string): Promise<{
  heroAppearance: string;
  petHint: string | null;
}> {
  const equippedAvatar = await getEquippedAvatar(childId);
  const equippedPet = await getEquippedPet(childId);
  const parts: string[] = [];
  // `getEquippedAvatar` returns `Record<slotId, SlotEquip>` where each
  // SlotEquip carries `unlockRef`. The catalog resolver expects that ref.
  const hatRef = equippedAvatar?.hat?.unlockRef ?? null;
  const topRef = equippedAvatar?.top?.unlockRef ?? null;
  if (hatRef) {
    parts.push(resolveNarrativeHint(hatRef));
  }
  if (topRef) {
    parts.push(resolveNarrativeHint(topRef));
  }
  const heroAppearance =
    parts.length > 0 ? parts.join(' and ') : 'a young pirate kid';
  const petHint = equippedPet
    ? `a ${equippedPet.nameEn.toLowerCase()}`
    : null;
  return { heroAppearance, petHint };
}

async function getPriorChapterSummary(
  childId: string,
  weekId: string,
): Promise<string> {
  // Prior chapter = most recent chapter for THIS child that isn't this week.
  // Empty string for first chapter ever.
  const chapters = await listStoryChaptersForChild(childId);
  const prior = chapters.find((c) => c.weekId !== weekId);
  return prior?.summaryForNext ?? '';
}

export async function generateStoryChapter(
  input: z.input<typeof GenerateInputSchema>,
): Promise<StoryChapterRow> {
  const parsed = GenerateInputSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const existing = await getStoryChapterByWeek(child.id, parsed.weekId);
  if (existing) return existing;

  const week = await getPlayableWeekForChild(child.id, parsed.weekId);
  if (!week) throw new Error('generateStoryChapter: week not playable');

  const bossScorePct = await getLatestBossScoreForChildWeek(
    child.id,
    parsed.weekId,
  );
  const tone = toneFromScore(bossScorePct);

  const [availableChars, weekChars, hero, priorSummary] = await Promise.all([
    getCharactersAvailableForChildWeek(parsed.weekId),
    getCharactersWithDetailsForWeek(parsed.weekId),
    buildHeroAppearance(child.id),
    getPriorChapterSummary(child.id, parsed.weekId),
  ]);

  // CharacterRow uses `hanzi` for the Chinese character string.
  const newCharsThisWeek = weekChars.map((c) => c.hanzi);

  const ai = await generateStoryChapterWithAI({
    heroName: child.displayName ?? 'Captain',
    heroAppearance: hero.heroAppearance,
    petHint: hero.petHint,
    availableChars,
    newCharsThisWeek,
    priorSummary,
    tone,
  });

  const row = await upsertStoryChapter({
    childId: child.id,
    weekId: parsed.weekId,
    bodyZh: ai.bodyZh,
    bodyEn: ai.bodyEn,
    summaryForNext: ai.summaryForNext,
    tone,
    bossScorePct,
  });

  await checkAndGrantTrophies(child.id, { kind: 'story-chapter-generated' });
  return row;
}

const MarkReadSchema = z.object({
  chapterId: z.string(),
  childId: z.string(),
});

export async function markChapterReadAction(
  input: z.input<typeof MarkReadSchema>,
): Promise<{ ok: true; cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null }> {
  const parsed = MarkReadSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  const { wasNew } = await markChapterRead(parsed.chapterId, child.id);
  let cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null = null;
  if (wasNew) {
    cardGrant = await pullCardForChild(child.id, 'story_chapter', parsed.chapterId);
  }
  revalidatePath(`/play/${child.id}`);
  return { ok: true, cardGrant };
}
