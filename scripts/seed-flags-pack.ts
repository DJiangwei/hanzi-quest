/**
 * Seed the World Flags collection pack (PR #23).
 *
 * Usage:
 *   pnpm tsx scripts/seed-flags-pack.ts
 *
 * Idempotent: re-running upserts by stable slug. Safe to run on every deploy;
 * only inserts what is missing.
 *
 * What it does:
 *   1. Upserts the `flags-v1` row in `collection_packs` (slug-unique).
 *   2. Upserts 30 country rows in `collectible_items`, bilingual labels +
 *      capital info embedded in the lore lines.
 *   3. The emoji flag is stored verbatim in `image_url` (the renderer uses it
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
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { FLAGS } = await import('../src/lib/collections/flagsData');

  // 1. Upsert the flags pack.
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'flags-v1',
      name: '世界国旗',
      description: 'Collect flags and capitals from around the world.',
      themeColor: '#3aa8e3',
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
        .where(eq(collectionPacks.slug, 'flags-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert flags pack');

  // 2. Insert any missing countries.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = FLAGS.filter((f) => !existingSlugs.has(f.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((f) => ({
        packId: packRow.id,
        slug: f.slug,
        nameZh: f.nameZh,
        nameEn: f.nameEn,
        // Bilingual lore: opens with capital info so the reveal animation can
        // surface it verbatim, then the fun fact.
        loreZh: `首都：${f.capitalZh}。${f.loreZh}`,
        loreEn: `Capital: ${f.capitalEn}. ${f.loreEn}`,
        rarity: f.rarity,
        dropWeight: f.dropWeight,
        imageUrl: f.emoji,
      })),
    );
  }

  console.log(
    `seeded flags pack: ${FLAGS.length} countries, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
