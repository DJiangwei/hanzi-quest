/**
 * Seed the 恐龙世界 / Dinosaurs collection pack (PR #26).
 *
 * Usage:
 *   pnpm tsx scripts/seed-dinosaurs-pack.ts
 *
 * Idempotent: re-running upserts by stable slug. Safe to run on every deploy;
 * only inserts what is missing.
 *
 * What it does:
 *   1. Upserts the `dinosaurs-v1` row in `collection_packs` (slug-unique).
 *   2. Upserts ~15 dinosaur rows in `collectible_items`, bilingual labels +
 *      era info embedded in the lore lines.
 *   3. The emoji glyph (🦖 / 🦕) is stored verbatim in `image_url` (the
 *      renderer uses it as a text glyph, not a URL).
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
  const { DINOSAURS, ERA_LABELS } = await import(
    '../src/lib/collections/dinosaursData'
  );

  // 1. Upsert the dinosaurs pack.
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'dinosaurs-v1',
      name: '恐龙世界',
      description: 'Giant beasts from millions of years ago.',
      themeColor: '#f97316',
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
        .where(eq(collectionPacks.slug, 'dinosaurs-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert dinosaurs pack');

  // 2. Insert any missing dinosaurs.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = DINOSAURS.filter((d) => !existingSlugs.has(d.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((d) => ({
        packId: packRow.id,
        slug: d.slug,
        nameZh: d.nameZh,
        nameEn: d.nameEn,
        // Bilingual lore: opens with era so the reveal animation surfaces the
        // age period, then the fun fact.
        loreZh: `时代：${ERA_LABELS[d.era].zh}。${d.loreZh}`,
        loreEn: `Era: ${ERA_LABELS[d.era].en}. ${d.loreEn}`,
        rarity: d.rarity,
        dropWeight: d.dropWeight,
        imageUrl: d.emoji,
      })),
    );
  }

  console.log(
    `seeded dinosaurs pack: ${DINOSAURS.length} dinosaurs, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
