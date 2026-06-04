/**
 * Seed shop avatar items (PR #21).
 *
 * Usage:
 *   pnpm tsx scripts/seed-shop-avatar-items.ts
 *
 * Idempotent: re-running upserts by stable slug/unlock_ref. Safe to run on
 * every deploy; only inserts what is missing.
 *
 * What it does:
 *   1. Upserts the four avatar_slots rows: head, hat, top, background.
 *   2. For each default item in the catalog (priceCoins undefined), upserts an
 *      avatar_items row with unlock_via='default'.
 *   3. For each shop item in the catalog (priceCoins defined), upserts:
 *        - avatar_items (unlock_via='shop', unlock_ref=slug)
 *        - shop_items (slug, kind='avatar', priceCoins, metadata.rarity)
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }

  const { db } = await import('../src/db');
  const { avatarSlots, avatarItems, shopItems } = await import(
    '../src/db/schema'
  );
  const { and, eq } = await import('drizzle-orm');
  const { allItems, defaultItems, shopItemsCatalog } = await import(
    '../src/lib/avatar/itemCatalog'
  );

  // ── 1. avatar_slots ──────────────────────────────────────────────────────
  const SLOTS = [
    { id: 'head', displayOrder: 1 },
    { id: 'background', displayOrder: 2 },
    { id: 'top', displayOrder: 3 },
    { id: 'hat', displayOrder: 4 },
  ];
  for (const slot of SLOTS) {
    await db
      .insert(avatarSlots)
      .values(slot)
      .onConflictDoUpdate({
        target: avatarSlots.id,
        set: { displayOrder: slot.displayOrder },
      });
  }
  console.log(`upserted ${SLOTS.length} avatar_slots rows`);

  // ── 2. default avatar_items ──────────────────────────────────────────────
  const defaults = defaultItems();
  let defaultsInserted = 0;
  for (const item of defaults) {
    const [existing] = await db
      .select({ id: avatarItems.id })
      .from(avatarItems)
      .where(
        and(
          eq(avatarItems.unlockRef, item.unlockRef),
          eq(avatarItems.unlockVia, 'default'),
        ),
      )
      .limit(1);
    if (existing) continue;
    await db.insert(avatarItems).values({
      slotId: item.slot,
      name: item.displayName,
      unlockVia: 'default',
      unlockRef: item.unlockRef,
      theme: item.theme,  // PR #58: theme field
    });
    defaultsInserted++;
  }
  console.log(
    `default avatar items: ${defaults.length} catalog, ${defaultsInserted} newly inserted`,
  );

  // ── 3. shop avatar_items + shop_items ────────────────────────────────────
  const shopCatalog = shopItemsCatalog();
  let avatarRowsInserted = 0;
  let shopRowsInserted = 0;
  for (const item of shopCatalog) {
    if (item.priceCoins === undefined || !item.rarity) {
      throw new Error(
        `Catalog inconsistency: ${item.unlockRef} missing price or rarity`,
      );
    }

    // 3a. avatar_items row (one per unlockRef, unlock_via='shop')
    const [existingAvatarItem] = await db
      .select({ id: avatarItems.id })
      .from(avatarItems)
      .where(
        and(
          eq(avatarItems.unlockRef, item.unlockRef),
          eq(avatarItems.unlockVia, 'shop'),
        ),
      )
      .limit(1);
    if (!existingAvatarItem) {
      await db.insert(avatarItems).values({
        slotId: item.slot,
        name: item.displayName,
        unlockVia: 'shop',
        unlockRef: item.unlockRef,
        theme: item.theme,  // PR #58: theme field
      });
      avatarRowsInserted++;
    }

    // 3b. shop_items row (slug = unlockRef)
    const [existingShopItem] = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, item.unlockRef))
      .limit(1);
    if (!existingShopItem) {
      await db.insert(shopItems).values({
        slug: item.unlockRef,
        kind: 'avatar',
        name: item.displayName,
        description: item.description ?? null,
        priceCoins: item.priceCoins,
        isActive: true,
        metadata: { rarity: item.rarity, slot: item.slot },
      });
      shopRowsInserted++;
    } else {
      // Update price/name/metadata in case the catalog changed
      await db
        .update(shopItems)
        .set({
          kind: 'avatar',
          name: item.displayName,
          description: item.description ?? null,
          priceCoins: item.priceCoins,
          isActive: true,
          metadata: { rarity: item.rarity, slot: item.slot },
        })
        .where(eq(shopItems.id, existingShopItem.id));
    }
  }
  console.log(
    `shop catalog: ${shopCatalog.length} items, ${avatarRowsInserted} new avatar_items, ${shopRowsInserted} new shop_items`,
  );

  console.log(`total catalog size: ${allItems().length} items`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
