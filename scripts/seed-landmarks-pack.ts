/**
 * Seed the 世界地标 / World Landmarks collection pack.
 *
 * Usage:
 *   pnpm tsx scripts/seed-landmarks-pack.ts
 *
 * Idempotent: re-running upserts by stable slug; only inserts what's missing.
 *
 * What it does:
 *   1. Upserts the `landmarks-v1` row in `collection_packs` (slug-unique, active).
 *   2. Upserts the landmark rows in `collectible_items`, bilingual labels +
 *      location embedded in the lore lines (mirrors the flags pack).
 *   3. The emoji glyph is stored verbatim in `image_url` (rendered as text).
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
  const { LANDMARKS } = await import('../src/lib/collections/landmarksData');

  // 1. Upsert the landmarks pack.
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'landmarks-v1',
      name: '世界地标',
      description: 'Famous landmarks from around the world.',
      themeColor: '#e8893a',
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const packRow =
    pack ??
    (
      await db
        .select()
        .from(collectionPacks)
        .where(eq(collectionPacks.slug, 'landmarks-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert landmarks pack');

  // 2. Insert any missing landmarks.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = LANDMARKS.filter((l) => !existingSlugs.has(l.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((l) => ({
        packId: packRow.id,
        slug: l.slug,
        nameZh: l.nameZh,
        nameEn: l.nameEn,
        // Bilingual lore: opens with location info, then the fun fact.
        loreZh: `位置：${l.locationZh}。${l.loreZh}`,
        loreEn: `Location: ${l.locationEn}. ${l.loreEn}`,
        rarity: l.rarity,
        dropWeight: l.dropWeight,
        imageUrl: l.emoji,
      })),
    );
  }

  console.log(
    `seeded landmarks pack: ${LANDMARKS.length} landmarks, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
