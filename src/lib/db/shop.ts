import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  avatarItems,
  childAvatarEquipped,
  childAvatarInventory,
  coinBalances,
  powerupInventory,
  shopItems,
  shopPurchases,
} from '@/db/schema';
import { awardCoinsInTx } from './coins';
import type { GrantedTrophy } from './trophies';
import {
  AlreadyOwnedError,
  InsufficientCoinsError,
  ItemNotPurchasableError,
  NotOwnedError,
  ShopItemNotFoundError,
} from '@/lib/errors/shop-errors';

// Re-export so existing call sites that import from '@/lib/db/shop' keep
// working without pulling postgres into the client bundle. New client code
// should import directly from '@/lib/errors/shop-errors'.
export {
  AlreadyOwnedError,
  InsufficientCoinsError,
  ItemNotPurchasableError,
  NotOwnedError,
  ShopItemNotFoundError,
};

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ShopItemRow = typeof shopItems.$inferSelect;
export type AvatarItemRow = typeof avatarItems.$inferSelect;

export interface AvatarShopListing {
  shopItem: ShopItemRow;
  avatarItem: AvatarItemRow;
}

export interface SlotEquip {
  avatarItemId: string;
  unlockRef: string | null;
  slotId: string;
  isDefault: boolean;
}

export type EquippedAvatar = Record<string, SlotEquip>;

export interface PurchaseResult {
  shopItemId: string;
  coinsAfter: number;
  avatarItemId: string | null;
  trophies?: GrantedTrophy[];
}

/**
 * Active avatar listings: every active shop_items row whose kind is 'avatar',
 * joined to the avatar_items row it points at (avatar_items.unlock_ref equals
 * shop_items.slug for items unlocked via shop).
 */
export async function listAvatarShopListings(): Promise<AvatarShopListing[]> {
  const rows = await db
    .select({ shopItem: shopItems, avatarItem: avatarItems })
    .from(shopItems)
    .innerJoin(
      avatarItems,
      and(
        eq(avatarItems.unlockRef, shopItems.slug),
        eq(avatarItems.unlockVia, 'shop'),
      ),
    )
    .where(and(eq(shopItems.kind, 'avatar'), eq(shopItems.isActive, true)));
  return rows;
}

/**
 * shop_items.id set for items already purchased by this child. Used by the
 * UI to render the "已购买" chip.
 */
export async function listChildOwnedShopItemIds(
  childId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ shopItemId: shopPurchases.shopItemId })
    .from(shopPurchases)
    .where(eq(shopPurchases.childId, childId));
  return new Set(rows.map((r) => r.shopItemId));
}

/**
 * The avatar_items rows with unlock_via='default'. One per slot is expected
 * once the seed has run. Used as a fallback when a child has no equipped row
 * for a slot.
 */
export async function listDefaultAvatarItems(): Promise<AvatarItemRow[]> {
  return db
    .select()
    .from(avatarItems)
    .where(eq(avatarItems.unlockVia, 'default'));
}

/**
 * Returns the child's currently-equipped avatar item per slot. For any slot
 * where the child has no equipped row (or has equipped null), falls back to
 * the default item for that slot.
 */
export async function getEquippedAvatar(
  childId: string,
): Promise<EquippedAvatar> {
  const defaults = await listDefaultAvatarItems();
  const defaultBySlot: Record<string, AvatarItemRow> = {};
  for (const item of defaults) defaultBySlot[item.slotId] = item;

  const equipRows = await db
    .select({
      slotId: childAvatarEquipped.slotId,
      avatarItem: avatarItems,
    })
    .from(childAvatarEquipped)
    .innerJoin(
      avatarItems,
      eq(avatarItems.id, childAvatarEquipped.avatarItemId),
    )
    .where(eq(childAvatarEquipped.childId, childId));

  const result: EquippedAvatar = {};
  for (const slotId of Object.keys(defaultBySlot)) {
    const def = defaultBySlot[slotId];
    result[slotId] = {
      avatarItemId: def.id,
      unlockRef: def.unlockRef,
      slotId: def.slotId,
      isDefault: true,
    };
  }
  for (const row of equipRows) {
    result[row.slotId] = {
      avatarItemId: row.avatarItem.id,
      unlockRef: row.avatarItem.unlockRef,
      slotId: row.avatarItem.slotId,
      isDefault: row.avatarItem.unlockVia === 'default',
    };
  }
  return result;
}

/**
 * Atomically: deduct coins, log the purchase, grant the linked avatar item to
 * the child's inventory. Throws InsufficientCoinsError / AlreadyOwnedError /
 * ShopItemNotFoundError as appropriate; the whole transaction rolls back on
 * any throw.
 */
export async function purchaseShopItem(
  childId: string,
  shopItemId: string,
): Promise<PurchaseResult> {
  return db.transaction((tx) => purchaseShopItemInTx(tx, childId, shopItemId));
}

export async function purchaseShopItemInTx(
  tx: Tx,
  childId: string,
  shopItemId: string,
): Promise<PurchaseResult> {
  const [shopItem] = await tx
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.id, shopItemId), eq(shopItems.isActive, true)))
    .limit(1);
  if (!shopItem) throw new ShopItemNotFoundError(shopItemId);

  switch (shopItem.kind) {
    case 'avatar':
      return purchaseAvatarInTx(tx, childId, shopItem);
    case 'sound_theme':
    case 'pet':
    case 'decor':
      return purchaseGenericInTx(tx, childId, shopItem);
    case 'powerup':
      return purchasePowerupInTx(tx, childId, shopItem);
    default:
      throw new ItemNotPurchasableError(
        `Shop item kind '${shopItem.kind}' is not purchasable`,
      );
  }
}

async function purchaseAvatarInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<PurchaseResult> {
  const [linkedAvatarItem] = await tx
    .select()
    .from(avatarItems)
    .where(
      and(
        eq(avatarItems.unlockRef, shopItem.slug),
        eq(avatarItems.unlockVia, 'shop'),
      ),
    )
    .limit(1);
  if (!linkedAvatarItem) {
    throw new ItemNotPurchasableError(
      `Shop item ${shopItem.slug} has no linked avatar_items row — seed is out of sync`,
    );
  }

  const [existing] = await tx
    .select()
    .from(childAvatarInventory)
    .where(
      and(
        eq(childAvatarInventory.childId, childId),
        eq(childAvatarInventory.avatarItemId, linkedAvatarItem.id),
      ),
    )
    .limit(1);
  if (existing) throw new AlreadyOwnedError(shopItem.id);

  await debitAndRecordInTx(tx, childId, shopItem);

  await tx.insert(childAvatarInventory).values({
    childId,
    avatarItemId: linkedAvatarItem.id,
  });

  const coinsAfter = await readBalanceInTx(tx, childId);
  return {
    shopItemId: shopItem.id,
    coinsAfter,
    avatarItemId: linkedAvatarItem.id,
  };
}

async function purchaseGenericInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<PurchaseResult> {
  // Ownership for sound_theme / pet / decor = presence of a shop_purchases row.
  // No per-kind inventory side-effect (unlike avatar).
  const [existing] = await tx
    .select()
    .from(shopPurchases)
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopPurchases.shopItemId, shopItem.id),
      ),
    )
    .limit(1);
  if (existing) throw new AlreadyOwnedError(shopItem.id);

  await debitAndRecordInTx(tx, childId, shopItem);

  const coinsAfter = await readBalanceInTx(tx, childId);
  return {
    shopItemId: shopItem.id,
    coinsAfter,
    avatarItemId: null,
  };
}

const VALID_POWERUP_KINDS = ['hint', 'skip', 'streak_freeze', 'revive'] as const;
type ValidPowerupKind = (typeof VALID_POWERUP_KINDS)[number];

async function purchasePowerupInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<PurchaseResult> {
  const meta = (shopItem.metadata ?? {}) as { powerupKind?: string };
  const kind = meta.powerupKind;
  if (!kind || !(VALID_POWERUP_KINDS as readonly string[]).includes(kind)) {
    throw new ItemNotPurchasableError(
      `Shop item ${shopItem.slug} has invalid metadata.powerupKind=${kind}`,
    );
  }

  // Powerups are stackable — no duplicate ownership check.
  await debitAndRecordInTx(tx, childId, shopItem);

  await tx
    .insert(powerupInventory)
    .values({ childId, kind: kind as ValidPowerupKind, count: 1 })
    .onConflictDoUpdate({
      target: [powerupInventory.childId, powerupInventory.kind],
      set: { count: sql`${powerupInventory.count} + 1` },
    });

  const coinsAfter = await readBalanceInTx(tx, childId);
  return {
    shopItemId: shopItem.id,
    coinsAfter,
    avatarItemId: null,
  };
}

async function debitAndRecordInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<void> {
  const [balRow] = await tx
    .select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));
  const balance = balRow?.balance ?? 0;
  if (balance < shopItem.priceCoins) {
    throw new InsufficientCoinsError(shopItem.priceCoins, balance);
  }

  await awardCoinsInTx(tx, {
    childId,
    delta: -shopItem.priceCoins,
    reason: 'shop_purchase',
    refType: 'shop_item',
    refId: shopItem.id,
  });

  await tx.insert(shopPurchases).values({
    childId,
    shopItemId: shopItem.id,
    coinsSpent: shopItem.priceCoins,
  });
}

async function readBalanceInTx(tx: Tx, childId: string): Promise<number> {
  const [row] = await tx
    .select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));
  return row?.balance ?? 0;
}

/**
 * Equips an avatar item into its slot for the given child. Validates that the
 * child owns it (default items are always considered owned).
 */
export async function equipAvatarItem(
  childId: string,
  avatarItemId: string,
): Promise<void> {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(avatarItems)
      .where(eq(avatarItems.id, avatarItemId))
      .limit(1);
    if (!item) throw new NotOwnedError(avatarItemId);

    if (item.unlockVia !== 'default') {
      const [owned] = await tx
        .select()
        .from(childAvatarInventory)
        .where(
          and(
            eq(childAvatarInventory.childId, childId),
            eq(childAvatarInventory.avatarItemId, avatarItemId),
          ),
        )
        .limit(1);
      if (!owned) throw new NotOwnedError(avatarItemId);
    }

    await tx
      .insert(childAvatarEquipped)
      .values({ childId, slotId: item.slotId, avatarItemId })
      .onConflictDoUpdate({
        target: [childAvatarEquipped.childId, childAvatarEquipped.slotId],
        set: { avatarItemId },
      });
  });
}

/**
 * All active shop_items rows of the given kind. Used by equipSoundThemeAction
 * to validate that a slug corresponds to a real, purchasable item.
 */
export async function listShopItemsByKind(
  kind: ShopItemRow['kind'],
): Promise<ShopItemRow[]> {
  return await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.kind, kind), eq(shopItems.isActive, true)));
}

export interface SoundThemeListing {
  shopItem: ShopItemRow;
}

export async function listSoundThemeListings(): Promise<SoundThemeListing[]> {
  const rows = await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.kind, 'sound_theme'), eq(shopItems.isActive, true)));
  return rows.map((shopItem) => ({ shopItem }));
}

/**
 * shop_items + inventory + default rows joined into a single payload the
 * /shop page can hydrate against without N+1.
 */
export async function getShopPageData(childId: string): Promise<{
  listings: AvatarShopListing[];
  ownedShopItemIds: string[];
  equipped: EquippedAvatar;
  coinBalance: number;
}> {
  const [listings, ownedSet, equipped, balRow] = await Promise.all([
    listAvatarShopListings(),
    listChildOwnedShopItemIds(childId),
    getEquippedAvatar(childId),
    db
      .select({ balance: coinBalances.balance })
      .from(coinBalances)
      .where(eq(coinBalances.childId, childId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  return {
    listings,
    ownedShopItemIds: Array.from(ownedSet),
    equipped,
    coinBalance: balRow?.balance ?? 0,
  };
}

