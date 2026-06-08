/**
 * Backfill pack-complete trophies (2026-06-07). The pack-complete trophy check
 * was only wired into the deprecated coin-gacha path, so children who finished
 * a pack via boss-clear cards / swaps never received the trophy. This re-runs
 * the (idempotent) check for every child × every collectible pack.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-pack-trophies.ts
 *
 * Idempotent: checkAndGrantTrophies inserts ON CONFLICT DO NOTHING, so already
 * earned trophies are untouched.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const PACK_SLUGS = [
  'zodiac-v1',
  'flags-v1',
  'sea-creatures-v1',
  'dinosaurs-v1',
  'solar-system-v1',
];

export async function backfillPackTrophies(): Promise<{ children: number; granted: number }> {
  const { db } = await import('@/db');
  const { childProfiles } = await import('@/db/schema');
  const { checkAndGrantTrophies } = await import('@/lib/db/trophies');

  const children = await db.select({ id: childProfiles.id }).from(childProfiles);
  let granted = 0;
  for (const child of children) {
    for (const packSlug of PACK_SLUGS) {
      const newly = await checkAndGrantTrophies(child.id, {
        kind: 'pack-complete',
        packSlug,
      });
      granted += newly.length;
    }
  }
  return { children: children.length, granted };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }
  const { children, granted } = await backfillPackTrophies();
  console.log(
    `[backfill-pack-trophies] checked ${children} child(ren); granted ${granted} new trophy/trophies`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[backfill-pack-trophies] failed:', err);
    process.exit(1);
  });
}
