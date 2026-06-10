/**
 * Seed the 节日 / Festivals collection pack (`festivals-v1`).
 *
 * Usage:
 *   pnpm tsx scripts/seed-festivals-pack.ts
 *
 * Idempotent: re-running upserts by stable slug; only inserts what's missing.
 *
 * What it does:
 *   1. Upserts the `festivals-v1` row in `collection_packs` — `is_active = true`
 *      (so it shows in the Backpack) but **`gacha_eligible = false`** (so its
 *      cards never drop from gacha / the weekly 大礼包; they're earned ONLY via
 *      the monthly festival challenge).
 *   2. Upserts the 12 festival rows in `collectible_items` (bilingual + lore).
 *      `image_url` is left NULL — the card renders its emoji glyph via CardArt.
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
  const { FESTIVAL_ITEMS } = await import('../src/lib/collections/festivalsData');

  // 1. Upsert the festivals pack (active in Backpack, excluded from gacha).
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'festivals-v1',
      name: '节日',
      description: 'Traditional Chinese festivals — earned via the monthly challenge.',
      themeColor: '#e11d48',
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
        .where(eq(collectionPacks.slug, 'festivals-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert festivals pack');

  // Ensure an existing pack row is gacha-excluded (in case it predated the flag).
  await db
    .update(collectionPacks)
    .set({ gachaEligible: false })
    .where(eq(collectionPacks.id, packRow.id));

  // 2. Insert any missing festival cards.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = FESTIVAL_ITEMS.filter((f) => !existingSlugs.has(f.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((f) => ({
        packId: packRow.id,
        slug: f.slug,
        nameZh: f.nameZh,
        nameEn: f.nameEn,
        loreZh: f.loreZh,
        loreEn: f.loreEn,
        rarity: 'rare' as const,
        dropWeight: 1,
        // image_url NULL → CardArt renders the emoji glyph from festivalsData.
      })),
    );
  }

  console.log(
    `seeded festivals pack: ${FESTIVAL_ITEMS.length} festivals, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
