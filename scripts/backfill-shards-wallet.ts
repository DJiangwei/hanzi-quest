/**
 * Backfill the universal shard wallet (`child_shards`) from the legacy per-pack
 * `shard_balances` table (2026-06-07 economy redesign). For each child, sums
 * all per-pack balances into one global wallet row.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-shards-wallet.ts
 *
 * Idempotent: SETS each child's wallet to the summed total (not additive), so
 * re-running is safe. Run ONCE right after migration 0024 deploys; further
 * shard activity uses `child_shards` directly.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

export async function backfillShardsWallet(): Promise<{ children: number; totalShards: number }> {
  const { db } = await import('@/db');
  const { shardBalances, childShards } = await import('@/db/schema/collections');

  const sums = await db
    .select({
      childId: shardBalances.childId,
      total: sql<number>`sum(${shardBalances.shards})`,
    })
    .from(shardBalances)
    .groupBy(shardBalances.childId);

  let totalShards = 0;
  for (const row of sums) {
    const total = Number(row.total) || 0;
    totalShards += total;
    await db
      .insert(childShards)
      .values({ childId: row.childId, shards: total })
      .onConflictDoUpdate({
        target: childShards.childId,
        set: { shards: total },
      });
  }

  return { children: sums.length, totalShards };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }
  const { children, totalShards } = await backfillShardsWallet();
  console.log(
    `[backfill-shards-wallet] wrote ${children} wallet(s), ${totalShards} shard(s) total`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[backfill-shards-wallet] failed:', err);
    process.exit(1);
  });
}
