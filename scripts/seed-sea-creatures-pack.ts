/**
 * Seed the 海洋生物 / Sea Creatures collection pack (PR #25).
 *
 * Usage:
 *   pnpm tsx scripts/seed-sea-creatures-pack.ts
 *
 * Idempotent: re-running upserts by stable slug. Safe to run on every deploy;
 * only inserts what is missing.
 *
 * What it does:
 *   1. Upserts the `sea-creatures-v1` row in `collection_packs` (slug-unique).
 *   2. Upserts ~20 creature rows in `collectible_items`, bilingual labels +
 *      habitat info embedded in the lore lines.
 *   3. The emoji glyph is stored verbatim in `image_url` (the renderer uses it
 *      as a text glyph, not a URL).
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }

  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import(
    '../src/db/schema'
  );
  const { eq } = await import('drizzle-orm');
  const { SEA_CREATURES } = await import(
    '../src/lib/collections/seaCreaturesData'
  );

  // 1. Upsert the sea-creatures pack.
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'sea-creatures-v1',
      name: '海洋生物',
      description: 'Every friend you meet on the high seas.',
      themeColor: '#14b8a6',
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
        .where(eq(collectionPacks.slug, 'sea-creatures-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert sea-creatures pack');

  // 2. Insert any missing creatures.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = SEA_CREATURES.filter((c) => !existingSlugs.has(c.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((c) => ({
        packId: packRow.id,
        slug: c.slug,
        nameZh: c.nameZh,
        nameEn: c.nameEn,
        // Bilingual lore: opens with habitat info so the reveal animation can
        // surface it verbatim, then the fun fact.
        loreZh: `栖息地：${c.habitatZh}。${c.loreZh}`,
        loreEn: `Habitat: ${c.habitatEn}. ${c.loreEn}`,
        rarity: c.rarity,
        dropWeight: c.dropWeight,
        imageUrl: c.emoji,
      })),
    );
  }

  console.log(
    `seeded sea-creatures pack: ${SEA_CREATURES.length} creatures, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
