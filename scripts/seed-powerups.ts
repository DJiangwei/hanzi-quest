/**
 * Seed 3 powerup shop_items. Idempotent skip-by-slug.
 *
 * Usage:
 *   pnpm tsx scripts/seed-powerups.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier writes to prod.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

interface PowerupSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  priceCoins: number;
  powerupKind: 'hint' | 'skip' | 'streak_freeze';
}

// Note: 'pw-hint' was retired 2026-06-07 — hints are now free in practice, so
// the shop no longer sells them. See scripts/retire-hint-powerup.ts.
const POWERUPS: PowerupSeed[] = [
  {
    slug: 'pw-skip',
    emoji: '⏭️',
    nameZh: '跳过',
    nameEn: 'Skip',
    descZh: '跳过当前关卡（不计分）。',
    descEn: 'Skip the current scene (no score).',
    priceCoins: 100,
    powerupKind: 'skip',
  },
  {
    slug: 'pw-freeze',
    emoji: '🧊',
    nameZh: '连胜冰冻',
    nameEn: 'Streak Freeze',
    descZh: '缺一天时自动保住连胜。',
    descEn: 'Auto-saves your streak when you miss one day.',
    priceCoins: 200,
    powerupKind: 'streak_freeze',
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  for (const p of POWERUPS) {
    const existing = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, p.slug))
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(shopItems).values({
      slug: p.slug,
      kind: 'powerup',
      name: `${p.emoji} ${p.nameZh} / ${p.nameEn}`,
      description: `${p.descZh}\n${p.descEn}`,
      imageUrl: p.emoji,
      priceCoins: p.priceCoins,
      isActive: true,
      metadata: { powerupKind: p.powerupKind },
    });
    inserted++;
    console.log(`  + ${p.slug} (${p.priceCoins} coins)`);
  }
  console.log(`Done. ${inserted} inserted, ${POWERUPS.length - inserted} skipped.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
