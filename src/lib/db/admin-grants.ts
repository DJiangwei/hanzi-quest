// NEVER import this file from client code. It pulls in postgres.
import { and, eq, sql } from 'drizzle-orm';
import {
  avatarItems,
  childAvatarEquipped,
  childAvatarInventory,
  childCollections,
  childShards,
  powerupInventory,
  shopItems,
  shopPurchases,
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

// ---------------------------------------------------------------------------
// Shop item revoke (undo path)
// ---------------------------------------------------------------------------

/**
 * Revoke ownership of a shop item — the inverse of `applyShopItemOwnershipInTx`.
 * Deletes the `shop_purchases` row. For `kind='avatar'` also removes the
 * `child_avatar_inventory` row and unequips from `child_avatar_equipped` if
 * currently worn.
 *
 * Best-effort: silently no-ops if the child doesn't own the item (undo of a
 * failed/partial grant).
 */
export async function revokeShopItemInTx(
  tx: Tx,
  childId: string,
  shopItemId: string,
): Promise<void> {
  // Load the shop item to determine its kind + slug (for avatar side-effects).
  const items = await tx
    .select({ id: shopItems.id, kind: shopItems.kind, slug: shopItems.slug })
    .from(shopItems)
    .where(eq(shopItems.id, shopItemId))
    .limit(1);
  if (items.length === 0) return; // item doesn't exist — nothing to revoke

  const item = items[0];

  // For avatar items: also remove from child_avatar_inventory and unequip.
  if (item.kind === 'avatar') {
    // Resolve the linked avatar_items row (unlockRef = shopItem.slug, unlockVia = 'shop').
    const linkedItems = await tx
      .select({ id: avatarItems.id })
      .from(avatarItems)
      .where(
        and(
          eq(avatarItems.unlockRef, item.slug),
          eq(avatarItems.unlockVia, 'shop'),
        ),
      )
      .limit(1);

    if (linkedItems.length > 0) {
      const avatarItemId = linkedItems[0].id;

      // Unequip from child_avatar_equipped if currently worn (set to null).
      // We delete the equip row to restore the default state.
      await tx
        .delete(childAvatarEquipped)
        .where(
          and(
            eq(childAvatarEquipped.childId, childId),
            eq(childAvatarEquipped.avatarItemId, avatarItemId),
          ),
        );

      // Remove from child_avatar_inventory.
      await tx
        .delete(childAvatarInventory)
        .where(
          and(
            eq(childAvatarInventory.childId, childId),
            eq(childAvatarInventory.avatarItemId, avatarItemId),
          ),
        );
    }
  }

  // Delete the shop_purchases row (applies to all kinds).
  await tx
    .delete(shopPurchases)
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopPurchases.shopItemId, shopItemId),
      ),
    );
}
