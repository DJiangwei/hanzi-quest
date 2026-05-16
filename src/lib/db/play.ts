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
  sceneType: 'flashcard' | 'audio_pick' | 'visual_pick' | 'image_pick' | 'word_match' | 'tracing' | 'boss';
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

export async function getCharacterById(characterId: string) {
  const [row] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  return row;
}
