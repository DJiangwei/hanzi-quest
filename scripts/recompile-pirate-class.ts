/**
 * Recompile every published week in the pirate-class-level-1 pack so the
 * boss level (added in PR #17) lands in the existing week_levels rows.
 *
 * Usage:
 *   pnpm tsx scripts/recompile-pirate-class.ts
 *
 * Idempotent: compileWeekIntoLevels drops the week's existing levels and
 * re-inserts the canonical sequence each call. Safe to re-run.
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
  const { weeks, curriculumPacks } = await import('../src/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { compileWeekIntoLevels } = await import('../src/lib/scenes/compile-week');

  const [pack] = await db
    .select({ id: curriculumPacks.id, slug: curriculumPacks.slug })
    .from(curriculumPacks)
    .where(eq(curriculumPacks.slug, 'pirate-class-level-1'))
    .limit(1);
  if (!pack) {
    console.error('Pack pirate-class-level-1 not found');
    process.exit(3);
  }

  const rows = await db
    .select({ id: weeks.id, weekNumber: weeks.weekNumber, status: weeks.status })
    .from(weeks)
    .where(and(eq(weeks.curriculumPackId, pack.id), eq(weeks.status, 'published')));

  if (rows.length === 0) {
    console.log('No published weeks found in pirate-class-level-1.');
    return;
  }

  console.log(`Found ${rows.length} published weeks. Recompiling…`);
  let totalLevels = 0;
  for (const week of rows) {
    const n = await compileWeekIntoLevels(week.id);
    totalLevels += n;
    console.log(`  Week ${week.weekNumber}: ${n} levels`);
  }

  console.log(
    `✅ recompiled ${rows.length} weeks · ${totalLevels} total levels (boss should appear when chars ≥ 10)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
