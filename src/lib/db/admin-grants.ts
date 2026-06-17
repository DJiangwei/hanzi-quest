// NEVER import this file from client code. It pulls in postgres.
import { and, eq, sql } from 'drizzle-orm';
import {
  childCollections,
  childShards,
  powerupInventory,
} from '@/db/schema';
import type { Tx } from '@/lib/db/shop';
export { applyShopItemOwnershipInTx } from '@/lib/db/shop';

// ---------------------------------------------------------------------------
// Shard grant / revoke
// ---------------------------------------------------------------------------

/**
 * Upsert the child's global shard wallet by `delta` (positive = grant, negative
 * = revoke). The stored balance is clamped at 0 — never goes negative.
 */
export async function grantShardsInTx(
  tx: Tx,
  childId: string,
  delta: number,
): Promise<void> {
  await tx
    .insert(childShards)
    .values({ childId, shards: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: childShards.childId,
      // GREATEST(0, current + delta) — never goes below 0
      set: { shards: sql`GREATEST(0, ${childShards.shards} + ${delta})` },
    });
}

// ---------------------------------------------------------------------------
// Powerup grant / revoke
// ---------------------------------------------------------------------------

/**
 * Upsert a powerup inventory entry by `delta`. Stored count is clamped at 0.
 */
export async function grantPowerupInTx(
  tx: Tx,
  childId: string,
  kind: 'hint' | 'skip' | 'streak_freeze' | 'revive',
  delta: number,
): Promise<void> {
  await tx
    .insert(powerupInventory)
    .values({ childId, kind, count: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: [powerupInventory.childId, powerupInventory.kind],
      set: { count: sql`GREATEST(0, ${powerupInventory.count} + ${delta})` },
    });
}

// ---------------------------------------------------------------------------
// Card grant / remove
// ---------------------------------------------------------------------------

/**
 * Add one copy of a collectible card to the child's collection (insert at 1,
 * or increment if already present).
 */
export async function grantSpecificCardInTx(
  tx: Tx,
  childId: string,
  itemId: string,
): Promise<void> {
  await tx
    .insert(childCollections)
    .values({ childId, itemId, count: 1 })
    .onConflictDoUpdate({
      target: [childCollections.childId, childCollections.itemId],
      set: { count: sql`${childCollections.count} + 1` },
    });
}

/**
 * Remove one copy of a collectible card (decrement count, delete row at 0).
 * Best-effort — silently no-ops if the row doesn't exist.
 */
export async function removeCardInTx(
  tx: Tx,
  childId: string,
  itemId: string,
): Promise<void> {
  await tx
    .update(childCollections)
    .set({ count: sql`${childCollections.count} - 1` })
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, itemId),
      ),
    );
  await tx
    .delete(childCollections)
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, itemId),
        sql`${childCollections.count} <= 0`,
      ),
    );
}
