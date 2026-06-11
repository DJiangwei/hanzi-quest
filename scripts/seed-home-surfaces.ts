/**
 * Seed shop_items rows for the buyable home surfaces (wallpapers + floors).
 *
 * Usage:
 *   pnpm tsx scripts/seed-home-surfaces.ts
 *
 * Idempotent: inserts only the surfaces whose slug isn't present. Surfaces are
 * sold as `kind='home'` (same generic purchase path as furniture); defaults
 * (`isDefault`) are NOT seeded — they're free + equippable without buying.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }

  const { db } = await import('../src/db');
  const { shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { SURFACES } = await import('../src/lib/home/surfaces');

  const buyables = SURFACES.filter((s) => !s.isDefault);
  let inserted = 0;

  for (const s of buyables) {
    const existing = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, s.slug))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(shopItems).values({
      slug: s.slug,
      kind: 'home',
      name: `${s.nameZh} / ${s.nameEn}`,
      priceCoins: s.priceCoins,
      metadata: { rarity: s.rarity, surfaceKind: s.kind },
    });
    inserted += 1;
  }

  console.log(
    `seeded home surfaces: ${buyables.length} buyable surfaces, ${inserted} newly inserted`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
