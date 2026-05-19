/**
 * Seed the 太阳系 / Solar System collection pack (PR #27).
 *
 * Usage:
 *   pnpm tsx scripts/seed-solar-system-pack.ts
 *
 * Idempotent: re-running upserts by stable slug. Safe to run on every deploy;
 * only inserts what is missing.
 *
 * What it does:
 *   1. Upserts the `solar-system-v1` row in `collection_packs` (slug-unique).
 *   2. Upserts 10 body rows in `collectible_items` (8 planets + Sun + Moon),
 *      bilingual labels + type info embedded in the lore lines.
 *   3. The emoji glyph is stored verbatim in `image_url` (the renderer uses
 *      it as a text glyph, not a URL).
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
  const { SOLAR_BODIES, TYPE_LABELS } = await import(
    '../src/lib/collections/solarSystemData'
  );

  // 1. Upsert the solar-system pack.
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'solar-system-v1',
      name: '太阳系',
      description: 'The Sun and its family of worlds.',
      themeColor: '#8b5cf6',
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
        .where(eq(collectionPacks.slug, 'solar-system-v1'))
        .limit(1)
    )[0];

  if (!packRow) throw new Error('Failed to upsert solar-system pack');

  // 2. Insert any missing bodies.
  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = SOLAR_BODIES.filter((b) => !existingSlugs.has(b.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((b) => ({
        packId: packRow.id,
        slug: b.slug,
        nameZh: b.nameZh,
        nameEn: b.nameEn,
        // Bilingual lore: opens with body type so the reveal animation
        // surfaces the category, then the fun fact.
        loreZh: `类型：${TYPE_LABELS[b.type].zh}。${b.loreZh}`,
        loreEn: `Type: ${TYPE_LABELS[b.type].en}. ${b.loreEn}`,
        rarity: b.rarity,
        dropWeight: b.dropWeight,
        imageUrl: b.emoji,
      })),
    );
  }

  console.log(
    `seeded solar-system pack: ${SOLAR_BODIES.length} bodies, ${toInsert.length} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
