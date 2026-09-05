/**
 * Renames the existing `pirate-class-level-1` pack to bilingual names
 * (Map 1 = 加勒比海 / Caribbean Sea) and inserts the `pirate-class-level-2`
 * placeholder (Map 2 = 里海 / Caspian Sea) with zero weeks. Re-runnable: an
 * existing Map 2 row has its theme names synced, not skipped.
 *
 * Usage: pnpm tsx scripts/seed-multi-map.ts
 *
 * CAUTION: shared DATABASE_URL writes to prod. Idempotent — safe to re-run.
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
  const { curriculumPacks } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  console.log('Renaming Map 1 → Caribbean Sea…');
  await db
    .update(curriculumPacks)
    .set({ nameZh: '加勒比海', nameEn: 'Caribbean Sea' })
    .where(eq(curriculumPacks.slug, 'pirate-class-level-1'));

  const existing = await db
    .select({ id: curriculumPacks.id })
    .from(curriculumPacks)
    .where(eq(curriculumPacks.slug, 'pirate-class-level-2'))
    .limit(1);

  // Map 2's THEME is data, and it has changed once already (印度洋 → 里海,
  // 2026-09-05). The slug stays `pirate-class-level-2` because it means "the
  // second map", not "the Indian Ocean" — but the names must be re-syncable,
  // so an existing row is UPDATED rather than skipped. A skip-if-exists here
  // is the same trap as the season seed's onConflictDoNothing: the TypeScript
  // changes and the live row never hears about it.
  const MAP_2 = {
    name: 'Caspian Sea / 里海',
    nameZh: '里海',
    nameEn: 'Caspian Sea',
  };

  if (existing.length === 0) {
    console.log(`Inserting Map 2 placeholder → ${MAP_2.nameEn}…`);
    await db.insert(curriculumPacks).values({
      slug: 'pirate-class-level-2',
      ...MAP_2,
      isPublic: true,
      ownerUserId: null,
    });
  } else {
    console.log(`Map 2 exists — syncing its theme to ${MAP_2.nameEn}…`);
    await db
      .update(curriculumPacks)
      .set(MAP_2)
      .where(eq(curriculumPacks.slug, 'pirate-class-level-2'));
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
