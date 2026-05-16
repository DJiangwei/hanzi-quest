import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  childCollections,
  coinBalances,
  collectibleItems,
  gachaPulls,
  shardBalances,
} from '@/db/schema';
import { awardCoinsInTx } from './coins';
import type { CollectibleItem } from './collections';

export type { CollectibleItem };

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PullResult {
  item: CollectibleItem;
  wasDuplicate: boolean;
  shardsAfter: number | null;
  coinsAfter: number;
}

export class InsufficientCoinsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient coins: need ${required}, have ${available}`);
    this.name = 'InsufficientCoinsError';
  }
}

export class AlreadyClaimedError extends Error {
  constructor() {
    super('Free pull already claimed for this week');
    this.name = 'AlreadyClaimedError';
  }
}

export async function pull(
  childId: string,
  packId: string,
  opts: { isFree: boolean; costCoins: number },
): Promise<PullResult> {
  return db.transaction((tx) => pullInTx(tx, childId, packId, opts));
}

export async function pullInTx(
  tx: Tx,
  childId: string,
  packId: string,
  opts: { isFree: boolean; costCoins: number },
): Promise<PullResult> {
  // 1. Read balance (needed for final coinsAfter; also guards paid pulls).
  const [balRow] = await tx
    .select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));

  if (!opts.isFree) {
    if (!balRow || balRow.balance < opts.costCoins) {
      throw new InsufficientCoinsError(opts.costCoins, balRow?.balance ?? 0);
    }
    await awardCoinsInTx(tx, {
      childId,
      delta: -opts.costCoins,
      reason: 'gacha_pull',
      refType: 'pack',
      refId: packId,
    });
  }

  // 2. Fetch pack items, compute total weight, roll.
  const items = await tx
    .select()
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packId));
  if (items.length === 0) {
    throw new Error(`Pack ${packId} is empty — seed before pulling`);
  }

  const totalWeight = items.reduce((s, i) => s + i.dropWeight, 0);
  let roll = Math.random() * totalWeight;
  let picked: (typeof items)[number] | undefined;
  for (const item of items) {
    roll -= item.dropWeight;
    if (roll <= 0) {
      picked = item;
      break;
    }
  }
  // Float-edge fallback: loop subtraction may never reach ≤ 0.
  picked ??= items[items.length - 1];

  // 3. Check if already owned.
  const [existing] = await tx
    .select()
    .from(childCollections)
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, picked.id),
      ),
    )
    .limit(1);
  const wasDuplicate = !!existing;

  // 4. Write collection / shard updates.
  let shardsAfter: number | null = null;
  if (wasDuplicate) {
    await tx
      .update(childCollections)
      .set({ count: sql`${childCollections.count} + 1` })
      .where(
        and(
          eq(childCollections.childId, childId),
          eq(childCollections.itemId, picked.id),
        ),
      );

    const [shardRow] = await tx
      .insert(shardBalances)
      .values({ childId, packId, shards: 1 })
      .onConflictDoUpdate({
        target: [shardBalances.childId, shardBalances.packId],
        set: { shards: sql`${shardBalances.shards} + 1` },
      })
      .returning();
    shardsAfter = shardRow.shards;
  } else {
    await tx.insert(childCollections).values({
      childId,
      itemId: picked.id,
      count: 1,
      firstObtainedAt: new Date(),
    });
  }

  // 5. Record the pull.
  await tx.insert(gachaPulls).values({
    childId,
    packId,
    costCoins: opts.costCoins,
    isFree: opts.isFree,
    resultItemId: picked.id,
    wasDuplicate,
  });

  // 6. Re-read coin balance for coinsAfter.
  const [finalBal] = await tx
    .select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));

  return {
    item: picked as PullResult['item'],
    wasDuplicate,
    shardsAfter,
    coinsAfter: finalBal?.balance ?? 0,
  };
}
