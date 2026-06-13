/**
 * Seed the 夏季航海 / Summer Voyage season card pack (`season-summer-v1`).
 *
 * Usage:
 *   pnpm tsx scripts/seed-season-cards.ts
 *
 * Idempotent: upserts by stable slug; only inserts what's missing.
 *
 * What it does:
 *   1. Upserts the `season-summer-v1` row in `collection_packs` — `is_active=true`
 *      (shows in Backpack) but **`gacha_eligible=false`** (its cards never drop
 *      from gacha / the weekly 大礼包; they're earned ONLY via the Season Pass).
 *   2. Upserts the 4 season cards in `collectible_items` (bilingual + lore + rarity).
 *      `image_url` is left NULL — the card renders its emoji glyph via CardArt
 *      until the CF-flux backfill populates real art.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }

  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { SEASON_CARD_ITEMS } = await import('../src/lib/collections/seasonCardsData');

  // 1. Upsert the season pack (active in Backpack, excluded from gacha).
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'season-summer-v1',
      name: '夏季航海',
      description: 'Season-exclusive cards — earned along the Summer Voyage track.',
      themeColor: '#14b8a6',
      isActive: true,
      gachaEligible: false,
    })
    .onConflictDoNothing()
    .returning();

  const packRow =
    pack ??
    (
      await db
        .select()
        .from(collectionPacks)
        .where(eq(collectionPacks.slug, 'season-summer-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert season pack');

  // Ensure the pack is gacha-excluded (in case it predated the flag).
  await db
    .update(collectionPacks)
    .set({ gachaEligible: false })
    .where(eq(collectionPacks.id, packRow.id));

  // 2. Insert any missing season cards.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = SEASON_CARD_ITEMS.filter((c) => !existingSlugs.has(c.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((c) => ({
        packId: packRow.id,
        slug: c.slug,
        nameZh: c.nameZh,
        nameEn: c.nameEn,
        loreZh: c.loreZh,
        loreEn: c.loreEn,
        rarity: c.rarity,
        dropWeight: 1,
        // image_url NULL → CardArt renders the emoji glyph from seasonCardsData.
      })),
    );
  }

  console.log(
    `seeded season cards pack: ${SEASON_CARD_ITEMS.length} cards, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
