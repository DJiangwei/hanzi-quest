'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireChild } from '@/lib/auth/guards';
import {
  awardCoins,
  awardDailyLoginIfDue,
  awardPerfectWeekIfDue,
  awardStreakMilestoneIfDue,
} from '@/lib/db/coins';
import {
  endPlaySession,
  getWeekProgress,
  hasPriorAttempt,
  isPerfectWeekForChild,
  listLevelsForWeek,
  recordSceneAttempt,
  startPlaySession,
  upsertWeekProgress,
} from '@/lib/db/play';
import { tickStreak, todayUtcIso } from '@/lib/db/streaks';
import {
  getPlayableWeekForChild,
  listCharactersForWeek,
} from '@/lib/db/weeks';

const SCENE_COMPLETE_AWARD = 50;
const SCENE_REPLAY_AWARD = 5;
const PERFECT_BONUS = 25;
const BOSS_CLEAR_REWARD = 300;

export type EconomyBonusReason =
  | 'daily_login'
  | 'streak_milestone'
  | 'perfect_week';

export interface EconomyBonus {
  reason: EconomyBonusReason;
  delta: number;
  labelZh: string;
  labelEn: string;
  meta?: { milestone?: number };
}

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
): Promise<{
  coinsAwarded: number;
  perfect: boolean;
  bonuses: EconomyBonus[];
}> {
  const parsed = FinishAttemptSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const isReplay = await hasPriorAttempt(child.id, parsed.weekLevelId);
  const baseAward = isReplay ? SCENE_REPLAY_AWARD : SCENE_COMPLETE_AWARD;
  const perfect =
    parsed.totalCount > 0 && parsed.correctCount === parsed.totalCount;
  const sceneBonus = perfect && !isReplay ? PERFECT_BONUS : 0;
  const coinsAwarded = baseAward + sceneBonus;

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
    if (sceneBonus > 0) {
      await awardCoins({
        childId: child.id,
        delta: sceneBonus,
        reason: 'scene_perfect_bonus',
        refType: 'scene_attempt',
        refId: attempt.id,
      });
    }
  }

  // Economy: tick the streak and award any due first-of-day / milestone
  // bonuses. Both helpers are idempotent so retries are safe.
  const bonuses: EconomyBonus[] = [];
  const today = todayUtcIso();
  const tick = await tickStreak(child.id, today);
  if (tick.ticked) {
    const daily = await awardDailyLoginIfDue(child.id, today);
    if (daily.awarded) {
      bonuses.push({
        reason: 'daily_login',
        delta: daily.delta,
        labelZh: '今日首战！',
        labelEn: "First play of the day!",
      });
    }
    const milestone = await awardStreakMilestoneIfDue(
      child.id,
      tick.currentStreak,
    );
    if (milestone.awarded && milestone.milestone) {
      bonuses.push({
        reason: 'streak_milestone',
        delta: milestone.delta,
        labelZh: `连胜 ${milestone.milestone} 天！`,
        labelEn: `${milestone.milestone}-day streak!`,
        meta: { milestone: milestone.milestone },
      });
    }
  }

  return { coinsAwarded, perfect, bonuses };
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
): Promise<{
  ok: true;
  bossCleared: boolean;
  bonuses: EconomyBonus[];
}> {
  const parsed = FinishLevelSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  // Use getPlayableWeekForChild — works for both per-family weeks AND shared
  // pack weeks (parent_user_id IS NULL + child enrolled in pack). The older
  // getWeekOwnedBy(weekId, parent.id) path was a regression for shared-pack
  // sessions (hotfix 22f0a24 patched the level page but missed this action).
  const week = await getPlayableWeekForChild(child.id, parsed.weekId);
  if (!week) throw new Error('Week not playable for this child');

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

  const bonuses: EconomyBonus[] = [];
  if (bossCleared && !alreadyAwarded) {
    await awardCoins({
      childId: child.id,
      delta: BOSS_CLEAR_REWARD,
      reason: 'boss_clear',
      refType: 'week',
      refId: parsed.weekId,
    });
    // Check for perfect-week bonus: every scene this child played for this
    // week must have at least one attempt with score=100.
    if (await isPerfectWeekForChild(child.id, parsed.weekId)) {
      const perfectAward = await awardPerfectWeekIfDue(child.id, parsed.weekId);
      if (perfectAward.awarded) {
        bonuses.push({
          reason: 'perfect_week',
          delta: perfectAward.delta,
          labelZh: '完美一周！',
          labelEn: 'Perfect week!',
        });
      }
    }
  }

  await endPlaySession(parsed.sessionId, {
    weekId: parsed.weekId,
    completionPercent,
    durationSeconds: parsed.durationSeconds,
  });

  revalidatePath(`/play/${child.id}`);
  return { ok: true, bossCleared, bonuses };
}

export async function listWeekChars(weekId: string, childId: string) {
  const { child } = await requireChild(childId);
  // Same fix as finishLevelAction — handle shared pack weeks where the parent
  // doesn't own the week directly.
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) return [];
  return listCharactersForWeek(weekId);
}
