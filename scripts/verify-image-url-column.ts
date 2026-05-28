/**
 * Read-only check that PR #42's migration 0016 has applied to the target DB.
 *
 * Verifies that:
 *   1. words.image_url column exists (via SELECT on it — Postgres errors if it
 *      doesn't exist).
 *   2. Reports how many words still have image_url IS NULL (i.e. how much work
 *      remains for the backfill).
 *
 * No writes. Safe to run against any environment.
 *
 * Usage: pnpm tsx scripts/verify-image-url-column.ts
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
  const { words } = await import('../src/db/schema');
  const { isNull, isNotNull, and, sql } = await import('drizzle-orm');

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(words);
  const [nullRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(words)
    .where(isNull(words.imageUrl));
  const [withHookButNoUrlRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(words)
    .where(and(isNull(words.imageUrl), isNotNull(words.imageHook)));

  console.log(`words.image_url column: ✅ exists (query succeeded)`);
  console.log(`total words:               ${totalRow.count}`);
  console.log(`words with image_url NULL: ${nullRow.count}`);
  console.log(`  …of those, with imageHook set (eligible for backfill): ${withHookButNoUrlRow.count}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Verification failed.');
    console.error(e);
    process.exit(1);
  });
