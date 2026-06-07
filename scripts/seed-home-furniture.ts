/**
 * Seed home furniture shop_items rows for all FURNITURE_CATALOG entries.
 * Idempotent — re-running is safe (upsert by slug).
 *
 * Usage:
 *   pnpm tsx scripts/seed-home-furniture.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

async function main() {
  const { db } = await import('../src/db');
  const { shopItems } = await import('../src/db/schema');
  const { FURNITURE_CATALOG } = await import('../src/lib/home/furniture-catalog');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  let skipped = 0;

  for (const furniture of FURNITURE_CATALOG) {
    const existing = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, furniture.slug))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(shopItems).values({
      slug: furniture.slug,
      kind: 'home',
      name: furniture.nameZh,
      priceCoins: furniture.priceCoins,
      isActive: true,
      metadata: {
        rarity: furniture.rarity,
        category: furniture.category,
      },
    });

    console.log(`  + ${furniture.slug} (${furniture.priceCoins} coins)`);
    inserted++;
  }

  console.log(
    `Done. Inserted ${inserted} shop_items, skipped ${skipped} (already exist).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
