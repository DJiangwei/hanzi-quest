'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireChild } from '@/lib/auth/guards';
import { awardCoins } from '@/lib/db/coins';
import {
  endPlaySession,
  getWeekProgress,
  hasPriorAttempt,
  listLevelsForWeek,
  recordSceneAttempt,
  startPlaySession,
  upsertWeekProgress,
} from '@/lib/db/play';
import { getWeekOwnedBy, listCharactersForWeek } from '@/lib/db/weeks';

const SCENE_COMPLETE_AWARD = 50;
const SCENE_REPLAY_AWARD = 5;
const PERFECT_BONUS = 25;
const BOSS_CLEAR_REWARD = 300;

export async function startSessionAction(
  childId: string,
): Promise<{ sessionId: string }> {
  const { child } = await requireChild(childId);
  const session = await startPlaySession({ childId: child.id });
  return { sessionId: session.id };
}

const FinishAttemptSchema = z.object({
  sessionId: z.string().uuid(),
  weekLevelId: z.string().uuid(),
  weekId: z.string().uuid(),
  childId: z.string().uuid(),
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  hintsUsed: z.number().int().min(0).default(0),
});

export async function finishAttemptAction(
  input: z.input<typeof FinishAttemptSchema>,
): Promise<{ coinsAwarded: number; perfect: boolean }> {
  const parsed = FinishAttemptSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const isReplay = await hasPriorAttempt(child.id, parsed.weekLevelId);
  const baseAward = isReplay ? SCENE_REPLAY_AWARD : SCENE_COMPLETE_AWARD;
  const perfect =
    parsed.totalCount > 0 && parsed.correctCount === parsed.totalCount;
  const bonus = perfect && !isReplay ? PERFECT_BONUS : 0;
  const coinsAwarded = baseAward + bonus;

  const score = parsed.totalCount > 0
    ? Math.round((parsed.correctCount / parsed.totalCount) * 100)
    : 100;

  const attempt = await recordSceneAttempt({
    sessionId: parsed.sessionId,
    weekLevelId: parsed.weekLevelId,
    correctCount: parsed.correctCount,
    totalCount: parsed.totalCount,
    hintsUsed: parsed.hintsUsed,
    score,
    coinsAwarded,
  });

  if (coinsAwarded > 0) {
    await awardCoins({
      childId: child.id,
      delta: coinsAwarded,
      reason: isReplay ? 'scene_replay' : 'scene_complete',
      refType: 'scene_attempt',
      refId: attempt.id,
    });
    if (bonus > 0) {
      await awardCoins({
        childId: child.id,
        delta: bonus,
        reason: 'scene_perfect_bonus',
        refType: 'scene_attempt',
        refId: attempt.id,
      });
    }
  }

  return { coinsAwarded, perfect };
}

const FinishLevelSchema = z.object({
  sessionId: z.string().uuid(),
  childId: z.string().uuid(),
  weekId: z.string().uuid(),
  totalScenesPassed: z.number().int().min(0),
  totalScenesInWeek: z.number().int().min(1),
  durationSeconds: z.number().int().min(0),
});

export async function finishLevelAction(
  input: z.input<typeof FinishLevelSchema>,
): Promise<{ ok: true; bossCleared: boolean }> {
  const parsed = FinishLevelSchema.parse(input);
  const { parent, child } = await requireChild(parsed.childId);

  const week = await getWeekOwnedBy(parsed.weekId, parent.id);
  if (!week) throw new Error('Week not found for this parent');
  if (week.childId !== child.id) {
    throw new Error('Week does not belong to this child');
  }

  const completionPercent = Math.round(
    (parsed.totalScenesPassed / parsed.totalScenesInWeek) * 100,
  );

  // Detect boss clear: last level type is 'boss' AND all scenes were passed.
  const levels = await listLevelsForWeek(parsed.weekId);
  const lastLevel = levels[levels.length - 1];
  const allScenesCleared = parsed.totalScenesPassed === parsed.totalScenesInWeek;
  const bossCleared = lastLevel?.sceneType === 'boss' && allScenesCleared;

  // Read existing progress BEFORE the upsert to guard against double-awarding on retry.
  const existing = await getWeekProgress(child.id, parsed.weekId);
  const alreadyAwarded = existing?.bossCleared === true;

  await upsertWeekProgress({
    childId: child.id,
    weekId: parsed.weekId,
    completionPercent,
    totalTimeDeltaSeconds: parsed.durationSeconds,
    bossCleared,
  });

  if (bossCleared && !alreadyAwarded) {
    await awardCoins({
      childId: child.id,
      delta: BOSS_CLEAR_REWARD,
      reason: 'boss_clear',
      refType: 'week',
      refId: parsed.weekId,
    });
  }

  await endPlaySession(parsed.sessionId, {
    weekId: parsed.weekId,
    completionPercent,
    durationSeconds: parsed.durationSeconds,
  });

  revalidatePath(`/play/${child.id}`);
  return { ok: true, bossCleared };
}

export async function listWeekChars(weekId: string, childId: string) {
  const { parent } = await requireChild(childId);
  const week = await getWeekOwnedBy(weekId, parent.id);
  if (!week || week.childId !== childId) return [];
  return listCharactersForWeek(weekId);
}
