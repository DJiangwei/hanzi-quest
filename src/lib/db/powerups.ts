import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { powerupInventory, sceneAttempts, shopItems } from '@/db/schema';

export type PowerupKind = 'hint' | 'skip' | 'streak_freeze';

export interface PowerupCounts {
  hint: number;
  skip: number;
  streak_freeze: number;
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PowerupShopListing {
  shopItem: typeof shopItems.$inferSelect;
}

export async function getPowerupCounts(childId: string): Promise<PowerupCounts> {
  const rows = await db
    .select({ kind: powerupInventory.kind, count: powerupInventory.count })
    .from(powerupInventory)
    .where(eq(powerupInventory.childId, childId));
  const counts: PowerupCounts = { hint: 0, skip: 0, streak_freeze: 0 };
  for (const row of rows) {
    if (row.kind === 'hint' || row.kind === 'skip' || row.kind === 'streak_freeze') {
      counts[row.kind] = row.count;
    }
  }
  return counts;
}

/** Atomic decrement. Returns true if decremented (count was > 0), false otherwise. */
export async function consumePowerupAtomic(
  childId: string,
  kind: PowerupKind,
  txOpt?: Tx,
): Promise<boolean> {
  const dbOrTx = txOpt ?? db;
  const rows = await dbOrTx
    .update(powerupInventory)
    .set({ count: sql`${powerupInventory.count} - 1` })
    .where(
      and(
        eq(powerupInventory.childId, childId),
        eq(powerupInventory.kind, kind),
        sql`${powerupInventory.count} > 0`,
      ),
    )
    .returning({ count: powerupInventory.count });
  return rows.length === 1;
}

/** UPSERT increment by 1. Used inside a transaction. */
export async function grantPowerup(
  tx: Tx,
  childId: string,
  kind: PowerupKind,
): Promise<void> {
  await tx
    .insert(powerupInventory)
    .values({ childId, kind, count: 1 })
    .onConflictDoUpdate({
      target: [powerupInventory.childId, powerupInventory.kind],
      set: { count: sql`${powerupInventory.count} + 1` },
    });
}

/** If inventory is empty for this child, grant 1 hint + 1 skip. Returns true if granted. */
export async function grantStarterPowerupsIfNeeded(childId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ kind: powerupInventory.kind })
      .from(powerupInventory)
      .where(eq(powerupInventory.childId, childId));
    if (existing.length > 0) return false;
    await grantPowerup(tx, childId, 'hint');
    await grantPowerup(tx, childId, 'skip');
    return true;
  });
}

/** Lists active shop_items where kind='powerup', wrapped as PowerupShopListing. */
export async function listPowerupShopListings(): Promise<PowerupShopListing[]> {
  const rows = await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.kind, 'powerup'), eq(shopItems.isActive, true)));
  return rows.map((shopItem) => ({ shopItem }));
}

/** Inserts a scene_attempts row representing a skipped scene (score=0). */
export async function recordSkippedAttempt(
  sessionId: string,
  weekLevelId: string,
): Promise<void> {
  await db.insert(sceneAttempts).values({
    sessionId,
    weekLevelId,
    correctCount: 0,
    totalCount: 1,
    hintsUsed: 0,
    score: 0,
    coinsAwarded: 0,
    completedAt: new Date(),
  });
}
