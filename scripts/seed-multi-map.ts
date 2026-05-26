/**
 * Renames the existing `pirate-class-level-1` pack to bilingual names
 * (Map 1 = 加勒比海 / Caribbean Sea) and inserts the `pirate-class-level-2`
 * placeholder (Map 2 = 印度洋 / Indian Ocean) with zero weeks.
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

  if (existing.length === 0) {
    console.log('Inserting Map 2 placeholder → Indian Ocean…');
    await db.insert(curriculumPacks).values({
      slug: 'pirate-class-level-2',
      name: 'Indian Ocean / 印度洋',
      nameZh: '印度洋',
      nameEn: 'Indian Ocean',
      isPublic: true,
      ownerUserId: null,
    });
  } else {
    console.log('Map 2 already exists, skipping insert.');
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
