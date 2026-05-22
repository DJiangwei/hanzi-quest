/**
 * Seed the 4 sound-theme shop items. Idempotent — re-running is safe.
 *
 * Usage:
 *   pnpm tsx scripts/seed-sound-themes.ts
 *
 * Pattern: same as scripts/seed-shop-avatar-items.ts. loadEnv first, then
 * dynamic import @/db inside main().
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if .env.local
 * points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

interface SoundThemeSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  priceCoins: number;
}

const THEMES: SoundThemeSeed[] = [
  {
    slug: 'theme-music-box',
    emoji: '🎼',
    nameZh: '音乐盒',
    nameEn: 'Music Box',
    descriptionZh: '每次答对都像音乐盒一样叮咚响。',
    descriptionEn: 'Mellow chimes for every right answer.',
    priceCoins: 200,
  },
  {
    slug: 'theme-retro-arcade',
    emoji: '🕹️',
    nameZh: '复古街机',
    nameEn: 'Retro Arcade',
    descriptionZh: '8 位机的电子音效。',
    descriptionEn: '8-bit blips like a coin-op.',
    priceCoins: 200,
  },
  {
    slug: 'theme-nautical',
    emoji: '⚓',
    nameZh: '海上钟',
    nameEn: 'Nautical',
    descriptionZh: '海上的铜钟与雾号。',
    descriptionEn: 'Sea bells and a foghorn for misses.',
    priceCoins: 250,
  },
  {
    slug: 'theme-fanfare-plus',
    emoji: '🎺',
    nameZh: '加长号角',
    nameEn: 'Fanfare Plus',
    descriptionZh: '通关时的加长胜利号角。',
    descriptionEn: 'Extended victory horn after boss + perfect week.',
    priceCoins: 300,
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  for (const t of THEMES) {
    const existing = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, t.slug))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(shopItems).values({
      slug: t.slug,
      kind: 'sound_theme',
      name: `${t.nameZh} / ${t.nameEn}`,
      description: `${t.descriptionZh}\n${t.descriptionEn}`,
      imageUrl: t.emoji,
      priceCoins: t.priceCoins,
      isActive: true,
    });
    inserted++;
    console.log(`  + ${t.slug} (${t.priceCoins} coins)`);
  }

  console.log(`Done. Inserted ${inserted} new themes (skipped ${THEMES.length - inserted}).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
