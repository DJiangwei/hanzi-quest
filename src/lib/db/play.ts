import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  characters,
  playSessions,
  sceneAttempts,
  sceneTemplates,
  weekLevels,
  weekProgress,
} from '@/db/schema';
import type { FlashcardConfig } from '@/lib/scenes/configs';

export type PlaySessionRow = typeof playSessions.$inferSelect;
export type SceneAttemptRow = typeof sceneAttempts.$inferSelect;

export async function startPlaySession(input: {
  childId: string;
  device?: string;
}): Promise<PlaySessionRow> {
  const [row] = await db
    .insert(playSessions)
    .values({ childId: input.childId, device: input.device ?? null })
    .returning();
  return row;
}

export async function endPlaySession(
  sessionId: string,
  summary: Record<string, unknown>,
): Promise<void> {
  await db
    .update(playSessions)
    .set({
      endedAt: sql`now()`,
      sessionSummary: summary,
    })
    .where(eq(playSessions.id, sessionId));
}

export interface CompiledLevel {
  id: string;
  position: number;
  sceneType: 'flashcard' | 'audio_pick' | 'visual_pick' | 'image_pick' | 'word_match' | 'tracing' | 'boss' | 'pinyin_pick' | 'translate_pick' | 'sentence_cloze' | 'image_word' | 'lianliankan';
  sceneConfig: FlashcardConfig | Record<string, unknown>;
}

export async function listLevelsForWeek(
  weekId: string,
): Promise<CompiledLevel[]> {
  const rows = await db
    .select({
      id: weekLevels.id,
      position: weekLevels.position,
      type: sceneTemplates.type,
      config: weekLevels.sceneConfig,
    })
    .from(weekLevels)
    .innerJoin(
      sceneTemplates,
      eq(sceneTemplates.id, weekLevels.sceneTemplateId),
    )
    .where(eq(weekLevels.weekId, weekId))
    .orderBy(asc(weekLevels.position));

  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    sceneType: r.type,
    sceneConfig: r.config as CompiledLevel['sceneConfig'],
  }));
}

export async function recordSceneAttempt(input: {
  sessionId: string;
  weekLevelId: string;
  correctCount: number;
  totalCount: number;
  hintsUsed: number;
  score: number;
  coinsAwarded: number;
}): Promise<SceneAttemptRow> {
  const [row] = await db
    .insert(sceneAttempts)
    .values({
      sessionId: input.sessionId,
      weekLevelId: input.weekLevelId,
      completedAt: sql`now()`,
      correctCount: input.correctCount,
      totalCount: input.totalCount,
      hintsUsed: input.hintsUsed,
      score: input.score,
      coinsAwarded: input.coinsAwarded,
    })
    .returning();
  return row;
}

export async function hasPriorAttempt(
  childId: string,
  weekLevelId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: sceneAttempts.id })
    .from(sceneAttempts)
    .innerJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
    .where(
      and(
        eq(playSessions.childId, childId),
        eq(sceneAttempts.weekLevelId, weekLevelId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * True iff every weekLevel for `weekId` has at least one sceneAttempt by
 * `childId` with score=100. Powers the +200 perfect_week bonus.
 */
export async function isPerfectWeekForChild(
  childId: string,
  weekId: string,
): Promise<boolean> {
  const rows = await db
    .select({
      levelId: weekLevels.id,
      bestScore: sql<number>`COALESCE(MAX(${sceneAttempts.score}), 0)`,
    })
    .from(weekLevels)
    .leftJoin(
      sceneAttempts,
      eq(sceneAttempts.weekLevelId, weekLevels.id),
    )
    .leftJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
    .where(
      and(
        eq(weekLevels.weekId, weekId),
        // Filter joined attempts to this child; levels with no attempts by
        // this child yield bestScore=0 (i.e., not perfect).
        sql`(${playSessions.childId} = ${childId} OR ${playSessions.childId} IS NULL)`,
      ),
    )
    .groupBy(weekLevels.id);

  if (rows.length === 0) return false;
  return rows.every((r) => r.bestScore >= 100);
}

export async function upsertWeekProgress(input: {
  childId: string;
  weekId: string;
  completionPercent: number;
  totalTimeDeltaSeconds: number;
  bossCleared?: boolean;
}): Promise<void> {
  const insertValues = {
    childId: input.childId,
    weekId: input.weekId,
    completionPercent: input.completionPercent,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lastPlayedAt: sql`now()` as any,
    totalTimeSeconds: input.totalTimeDeltaSeconds,
    ...(input.bossCleared ? { bossCleared: true } : {}),
  };

  const setOnConflict: Record<string, unknown> = {
    completionPercent: sql`GREATEST(${weekProgress.completionPercent}, ${input.completionPercent})`,
    lastPlayedAt: sql`now()`,
    totalTimeSeconds: sql`${weekProgress.totalTimeSeconds} + ${input.totalTimeDeltaSeconds}`,
  };
  if (input.bossCleared) {
    setOnConflict.bossCleared = sql`true`;
  }

  await db
    .insert(weekProgress)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [weekProgress.childId, weekProgress.weekId],
      set: setOnConflict,
    });
}

export async function listProgressByChild(
  childId: string,
): Promise<Array<{ weekId: string; completionPercent: number; bossCleared: boolean }>> {
  const rows = await db
    .select({
      weekId: weekProgress.weekId,
      completionPercent: weekProgress.completionPercent,
      bossCleared: weekProgress.bossCleared,
    })
    .from(weekProgress)
    .where(eq(weekProgress.childId, childId))
    .orderBy(desc(weekProgress.lastPlayedAt));
  return rows;
}

export async function getWeekProgress(
  childId: string,
  weekId: string,
): Promise<{ bossCleared: boolean; freePullClaimed: boolean } | null> {
  const [row] = await db
    .select({
      bossCleared: weekProgress.bossCleared,
      freePullClaimed: weekProgress.freePullClaimed,
    })
    .from(weekProgress)
    .where(
      and(
        eq(weekProgress.childId, childId),
        eq(weekProgress.weekId, weekId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getCharacterById(characterId: string) {
  const [row] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  return row;
}

export async function getLevelById(weekLevelId: string) {
  const rows = await db
    .select({
      id: weekLevels.id,
      weekId: weekLevels.weekId,
      sceneType: sceneTemplates.type,
    })
    .from(weekLevels)
    .innerJoin(sceneTemplates, eq(sceneTemplates.id, weekLevels.sceneTemplateId))
    .where(eq(weekLevels.id, weekLevelId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Week-Hub helpers (Task 3 — PR #35)
// ---------------------------------------------------------------------------

export type WeekSection = 'review' | 'practice' | 'boss';

export interface SectionStat {
  done: number;
  total: number;
}
export interface SectionStats {
  review: SectionStat;
  practice: SectionStat;
  boss: SectionStat;
}

export function segmentToSection(segment: string | undefined | null): WeekSection | null {
  if (segment === 'review') return 'review';
  if (segment === 'sound' || segment === 'sight' || segment === 'meaning') return 'practice';
  if (segment === 'boss') return 'boss';
  return null;
}

/**
 * Per-section stats for the WeekHub: {done, total} where "done" means at
 * least one cleared attempt (score >= 100) by this child.
 */
export async function getSectionStatsForChild(
  childId: string,
  weekId: string,
): Promise<SectionStats> {
  const rows = await db
    .select({
      id: weekLevels.id,
      segment: sql<string>`${weekLevels.sceneConfig}->>'segment'`.as('segment'),
      maxScore: sql<number | null>`MAX(${sceneAttempts.score})`.as('max_score'),
    })
    .from(weekLevels)
    .leftJoin(sceneAttempts, eq(sceneAttempts.weekLevelId, weekLevels.id))
    .leftJoin(
      playSessions,
      and(
        eq(playSessions.id, sceneAttempts.sessionId),
        eq(playSessions.childId, childId),
      ),
    )
    .where(eq(weekLevels.weekId, weekId))
    .groupBy(weekLevels.id, sql`${weekLevels.sceneConfig}->>'segment'`);

  const stats: SectionStats = {
    review:   { done: 0, total: 0 },
    practice: { done: 0, total: 0 },
    boss:     { done: 0, total: 0 },
  };
  for (const row of rows) {
    const section = segmentToSection(row.segment);
    if (!section) continue;
    stats[section].total += 1;
    if ((row.maxScore ?? 0) >= 100) stats[section].done += 1;
  }
  return stats;
}

/**
 * Count of distinct practice levels with at least one cleared attempt.
 * Used by the boss-unlock gate.
 */
export async function countPracticeClearedForChild(
  childId: string,
  weekId: string,
): Promise<number> {
  const stats = await getSectionStatsForChild(childId, weekId);
  return stats.practice.done;
}

/**
 * Returns all weekLevels in the given week filtered to the given section,
 * ordered by position. Used by the section-runner page.
 */
export async function getLevelsForSection(
  weekId: string,
  section: WeekSection,
): Promise<Array<typeof weekLevels.$inferSelect>> {
  // Fetch all rows for the week, filter in JS by derived section.
  // Cheaper to read than to thread the section JSON filter through drizzle's
  // JSON-path operators, and a week has only 23 rows max.
  const rows = await db
    .select()
    .from(weekLevels)
    .where(eq(weekLevels.weekId, weekId))
    .orderBy(weekLevels.position);
  return rows.filter((r) => {
    const segment = (r.sceneConfig as { segment?: string } | null)?.segment;
    return segmentToSection(segment ?? null) === section;
  });
}
