import { eq, sql } from 'drizzle-orm';
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
  | 'admin_adjust';

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
