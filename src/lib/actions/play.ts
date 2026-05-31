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
  getLevelById,
  getWeekProgress,
  hasPriorAttempt,
  isPerfectWeekForChild,
  listLevelsForWeek,
  recordSceneAttempt,
  startPlaySession,
  upsertWeekProgress,
} from '@/lib/db/play';
import { checkAndGrantTrophies, type GrantedTrophy } from '@/lib/db/trophies';
export type { GrantedTrophy } from '@/lib/db/trophies';
import { tickStreak, todayUtcIso } from '@/lib/db/streaks';
import {
  getPlayableWeekForChild,
  listCharactersForWeek,
} from '@/lib/db/weeks';
import { pullCardForChild } from './gacha';

const SCENE_COMPLETE_AWARD = 50;
const SCENE_REPLAY_AWARD = 5;
const PERFECT_BONUS = 25;
const BOSS_CLEAR_REWARD = 300;

/**
 * Kick off story chapter generation in the background. Errors are logged
 * but never bubble up — boss completion must succeed even if DeepSeek is
 * down. The chapter page synchronously falls back if eager gen didn't
 * finish in time.
 *
 * NOTE: this is `async` only to satisfy the `'use server'` constraint that
 * all exports must be async. Callers in this file invoke it WITHOUT await
 * (prefixed with `void`) so the fire-and-forget contract is preserved.
 */
export async function triggerEagerStoryGeneration(
  childId: string,
  weekId: string,
): Promise<void> {
  try {
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId, weekId });
  } catch (err) {
    console.error('[finishLevelAction] eager story gen failed:', err);
  }
}

export type EconomyBonusReason =
  | 'daily_login'
  | 'streak_milestone'
  | 'perfect_week'
  | 'streak_freeze';

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
  trophies: GrantedTrophy[];
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
    if (tick.freezeBurned) {
      bonuses.push({
        reason: 'streak_freeze',
        delta: 0,
        labelZh: '连胜保住了！',
        labelEn: 'Streak saved!',
      });
    }
  }

  const collectedTrophies: GrantedTrophy[] = [];

  // scene-clear trophy check (first-pinyin/translate/cloze)
  const levelRow = await getLevelById(parsed.weekLevelId);
  if (levelRow) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, {
        kind: 'scene-clear',
        sceneType: levelRow.sceneType as string,
        score,
      })),
    );
  }

  // level-complete trophy check (100/500-levels + streak rollups)
  collectedTrophies.push(
    ...(await checkAndGrantTrophies(child.id, { kind: 'level-complete' })),
  );

  // coin-award trophy check (only fires if a coin was just awarded)
  if (coinsAwarded > 0) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, { kind: 'coin-award' })),
    );
  }

  return { coinsAwarded, perfect, bonuses, trophies: collectedTrophies };
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
  freePullClaimed: boolean;
  cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null;
  bonuses: EconomyBonus[];
  trophies: GrantedTrophy[];
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
    // Eager story generation — fire-and-forget. Boss completion MUST NOT
    // depend on this; the story page synchronously regenerates if missing.
    void triggerEagerStoryGeneration(child.id, parsed.weekId);
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
        // First-time perfect_week: grant a card as a bonus reward.
        // Fire independently of the boss-clear cardGrant (a single boss run
        // can trigger both; each has a distinct source so deduplication in
        // pullCardForChild handles re-runs correctly).
        void pullCardForChild(child.id, 'perfect_week', parsed.weekId);
      }
    }
  }

  await endPlaySession(parsed.sessionId, {
    weekId: parsed.weekId,
    completionPercent,
    durationSeconds: parsed.durationSeconds,
  });

  const collectedTrophies: GrantedTrophy[] = [];

  if (bossCleared) {
    collectedTrophies.push(
      ...(await checkAndGrantTrophies(child.id, { kind: 'boss-clear', weekId: parsed.weekId })),
    );
  }

  // perfect-week — the bonus path already determined this; calling here is idempotent.
  collectedTrophies.push(
    ...(await checkAndGrantTrophies(child.id, { kind: 'perfect-week', weekId: parsed.weekId })),
  );

  // level-complete catches the rare boss-completion cross-100 case.
  collectedTrophies.push(
    ...(await checkAndGrantTrophies(child.id, { kind: 'level-complete' })),
  );

  let cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null = null;
  if (bossCleared) {
    cardGrant = await pullCardForChild(child.id, 'boss_clear', parsed.sessionId);
  }

  revalidatePath(`/play/${child.id}`);
  return {
    ok: true,
    bossCleared,
    freePullClaimed: existing?.freePullClaimed ?? false,
    cardGrant,
    bonuses,
    trophies: collectedTrophies,
  };
}

export async function listWeekChars(weekId: string, childId: string) {
  const { child } = await requireChild(childId);
  // Same fix as finishLevelAction — handle shared pack weeks where the parent
  // doesn't own the week directly.
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) return [];
  return listCharactersForWeek(weekId);
}
