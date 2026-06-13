import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { coinBalances, coinTransactions } from '@/db/schema';

export type CoinBalance = typeof coinBalances.$inferSelect;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AwardCoinReason =
  | 'scene_complete'
  | 'scene_replay'
  | 'scene_perfect_bonus'
  | 'boss_clear'
  | 'streak_daily'
  | 'shop_purchase'
  | 'gacha_pull'
  | 'shard_redeem'
  | 'admin_adjust'
  | 'daily_login'
  | 'streak_milestone'
  | 'perfect_week'
  | 'daily_chest'
  | 'homework_complete'
  | 'season_reward';

export const DAILY_LOGIN_AWARD = 20;
export const STREAK_MILESTONE_AWARD = 100;
export const PERFECT_WEEK_AWARD = 200;

interface AwardInput {
  childId: string;
  delta: number;
  reason: AwardCoinReason;
  refType?: string;
  refId?: string;
}

export async function getCoinBalance(childId: string): Promise<CoinBalance> {
  const [existing] = await db
    .select()
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(coinBalances)
    .values({ childId, balance: 0, lifetimeEarned: 0 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retry] = await db
    .select()
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId))
    .limit(1);
  if (!retry) {
    throw new Error(`getCoinBalance: failed to ensure row for ${childId}`);
  }
  return retry;
}

export async function awardCoinsInTx(tx: Tx, input: AwardInput): Promise<void> {
  if (input.delta === 0) return;
  await tx.insert(coinTransactions).values({
    childId: input.childId,
    delta: input.delta,
    reason: input.reason,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
  });
  await tx
    .insert(coinBalances)
    .values({
      childId: input.childId,
      balance: Math.max(input.delta, 0),
      lifetimeEarned: Math.max(input.delta, 0),
    })
    .onConflictDoUpdate({
      target: coinBalances.childId,
      set: {
        balance: sql`${coinBalances.balance} + ${input.delta}`,
        lifetimeEarned:
          input.delta > 0
            ? sql`${coinBalances.lifetimeEarned} + ${input.delta}`
            : sql`${coinBalances.lifetimeEarned}`,
        updatedAt: sql`now()`,
      },
    });
}

export async function awardCoins(input: AwardInput): Promise<void> {
  if (input.delta === 0) return;
  await db.transaction((tx) => awardCoinsInTx(tx, input));
}

/**
 * Returns true if a coin_transaction already exists for the given
 * (childId, reason, refType, refId) tuple. Used as the idempotency check
 * for daily-login / streak-milestone / perfect-week bonuses.
 */
async function hasExistingAward(
  childId: string,
  reason: AwardCoinReason,
  refType: string,
  refId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: coinTransactions.id })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.childId, childId),
        eq(coinTransactions.reason, reason),
        eq(coinTransactions.refType, refType),
        eq(coinTransactions.refId, refId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Awards +20 once per UTC date per child. Idempotent: re-calling on the
 * same date is a no-op. Reflects "first scene of the day" — call from
 * `finishAttemptAction` at scene completion.
 */
export async function awardDailyLoginIfDue(
  childId: string,
  todayIsoDate: string,
): Promise<{ awarded: boolean; delta: number }> {
  if (await hasExistingAward(childId, 'daily_login', 'utc_date', todayIsoDate)) {
    return { awarded: false, delta: 0 };
  }
  await awardCoins({
    childId,
    delta: DAILY_LOGIN_AWARD,
    reason: 'daily_login',
    refType: 'utc_date',
    refId: todayIsoDate,
  });
  return { awarded: true, delta: DAILY_LOGIN_AWARD };
}

/**
 * Awards +100 when a child's currentStreak crosses a multiple of 7
 * (7, 14, 21, ...). Idempotent: each milestone awards once per child.
 * Called *after* the streak counter has been incremented.
 */
export async function awardStreakMilestoneIfDue(
  childId: string,
  currentStreak: number,
): Promise<{ awarded: boolean; delta: number; milestone: number | null }> {
  if (currentStreak <= 0 || currentStreak % 7 !== 0) {
    return { awarded: false, delta: 0, milestone: null };
  }
  const refId = String(currentStreak);
  if (await hasExistingAward(childId, 'streak_milestone', 'streak_days', refId)) {
    return { awarded: false, delta: 0, milestone: currentStreak };
  }
  await awardCoins({
    childId,
    delta: STREAK_MILESTONE_AWARD,
    reason: 'streak_milestone',
    refType: 'streak_days',
    refId,
  });
  return { awarded: true, delta: STREAK_MILESTONE_AWARD, milestone: currentStreak };
}

/**
 * Awards +200 when a child clears a week with every scene having at least
 * one perfect attempt (score=100). Idempotent per (childId, weekId).
 */
export async function awardPerfectWeekIfDue(
  childId: string,
  weekId: string,
): Promise<{ awarded: boolean; delta: number }> {
  if (await hasExistingAward(childId, 'perfect_week', 'week', weekId)) {
    return { awarded: false, delta: 0 };
  }
  await awardCoins({
    childId,
    delta: PERFECT_WEEK_AWARD,
    reason: 'perfect_week',
    refType: 'week',
    refId: weekId,
  });
  return { awarded: true, delta: PERFECT_WEEK_AWARD };
}
