import { and, desc, eq, isNull, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import {
  characters,
  playSessions,
  sceneAttempts,
  sceneTemplates,
  storyChapters,
  weekCharacters,
  weekLevels,
  weeks,
} from '@/db/schema';

export type StoryTone = 'triumphant' | 'standard' | 'narrow_escape';

export interface StoryChapterRow {
  id: string;
  childId: string;
  weekId: string;
  bodyZh: string;
  bodyEn: string;
  summaryForNext: string;
  tone: StoryTone;
  bossScorePct: number;
  readAt: Date | null;
  createdAt: Date;
}

interface UpsertStoryChapterInput {
  childId: string;
  weekId: string;
  bodyZh: string;
  bodyEn: string;
  summaryForNext: string;
  tone: StoryTone;
  bossScorePct: number;
}

/**
 * Insert a story chapter for (childId, weekId). If a row already exists
 * (UNIQUE constraint), return the existing row instead — concurrent eager +
 * sync fallback paths both call this and one must lose without surfacing
 * an error.
 */
export async function upsertStoryChapter(
  input: UpsertStoryChapterInput,
): Promise<StoryChapterRow> {
  const inserted = await db
    .insert(storyChapters)
    .values({
      childId: input.childId,
      weekId: input.weekId,
      bodyZh: input.bodyZh,
      bodyEn: input.bodyEn,
      summaryForNext: input.summaryForNext,
      tone: input.tone,
      bossScorePct: input.bossScorePct,
    })
    .onConflictDoNothing({
      target: [storyChapters.childId, storyChapters.weekId],
    })
    .returning();
  if (inserted.length > 0) return inserted[0] as StoryChapterRow;

  const existing = await db
    .select()
    .from(storyChapters)
    .where(
      and(
        eq(storyChapters.childId, input.childId),
        eq(storyChapters.weekId, input.weekId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    throw new Error(
      'upsertStoryChapter: insert returned empty and no existing row',
    );
  }
  return existing[0] as StoryChapterRow;
}

export async function getStoryChapterByWeek(
  childId: string,
  weekId: string,
): Promise<StoryChapterRow | null> {
  const rows = await db
    .select()
    .from(storyChapters)
    .where(
      and(
        eq(storyChapters.childId, childId),
        eq(storyChapters.weekId, weekId),
      ),
    )
    .limit(1);
  return (rows[0] as StoryChapterRow | undefined) ?? null;
}

export async function listStoryChaptersForChild(
  childId: string,
): Promise<StoryChapterRow[]> {
  const rows = await db
    .select()
    .from(storyChapters)
    .where(eq(storyChapters.childId, childId))
    .orderBy(desc(storyChapters.createdAt));
  return rows as StoryChapterRow[];
}

export async function markChapterRead(
  chapterId: string,
  childId: string,
): Promise<void> {
  await db
    .update(storyChapters)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(storyChapters.id, chapterId),
        eq(storyChapters.childId, childId),
        isNull(storyChapters.readAt),
      ),
    );
}

export async function getLatestUnreadChapter(
  childId: string,
): Promise<StoryChapterRow | null> {
  const rows = await db
    .select()
    .from(storyChapters)
    .where(
      and(eq(storyChapters.childId, childId), isNull(storyChapters.readAt)),
    )
    .orderBy(desc(storyChapters.createdAt))
    .limit(1);
  return (rows[0] as StoryChapterRow | undefined) ?? null;
}

/**
 * Latest boss attempt score for a child+week. Returns 0 if no boss attempt
 * exists.
 *
 * Schema notes:
 * - sceneAttempts has no direct childId — joins via playSessions.childId.
 * - week_levels has no sceneType column — joins via scene_templates.type.
 * - sceneAttempts has no createdAt — orders by startedAt DESC.
 */
export async function getLatestBossScoreForChildWeek(
  childId: string,
  weekId: string,
): Promise<number> {
  const rows = await db
    .select({ score: sceneAttempts.score })
    .from(sceneAttempts)
    .innerJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
    .innerJoin(weekLevels, eq(weekLevels.id, sceneAttempts.weekLevelId))
    .innerJoin(sceneTemplates, eq(sceneTemplates.id, weekLevels.sceneTemplateId))
    .where(
      and(
        eq(playSessions.childId, childId),
        eq(weekLevels.weekId, weekId),
        eq(sceneTemplates.type, 'boss'),
      ),
    )
    .orderBy(desc(sceneAttempts.startedAt))
    .limit(1);
  return rows[0]?.score ?? 0;
}

/**
 * Characters available for story body_zh: every character in the
 * curriculum pack from week_number 1 through the current week's week_number.
 *
 * Implemented as a single query with a self-join (target week aliased) so
 * the test's chained-where mock terminates correctly. The schema field is
 * `weeks.weekNumber`; "sequenceIndex" is just the story-mode-facing name
 * for that ordinal.
 */
export async function getCharactersAvailableForChildWeek(
  weekId: string,
): Promise<string[]> {
  const target = alias(weeks, 'target_week');
  const rows = await db
    .select({ text: characters.hanzi })
    .from(characters)
    .innerJoin(weekCharacters, eq(weekCharacters.characterId, characters.id))
    .innerJoin(weeks, eq(weeks.id, weekCharacters.weekId))
    .innerJoin(target, eq(target.id, weekId))
    .where(
      and(
        eq(weeks.curriculumPackId, target.curriculumPackId),
        lte(weeks.weekNumber, target.weekNumber),
      ),
    );
  return rows.map((r) => r.text);
}
