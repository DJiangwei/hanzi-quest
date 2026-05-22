/**
 * Recompile every published week across all curriculum packs so PR #30's
 * 4-segment structure and new scene types take effect on existing weeks.
 *
 * Usage:
 *   pnpm tsx scripts/recompile-all-weeks.ts
 *
 * Idempotent: compileWeekIntoLevels drops the week's existing levels and
 * re-inserts the canonical sequence each call. Safe to re-run.
 *
 * CAUTION: DATABASE_URL is shared across Vercel envs on Neon free tier —
 * this WILL recompile prod weeks if you have prod's URL in .env.local.
 * Confirm before running.
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
  const { weeks } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { compileWeekIntoLevels } = await import('../src/lib/scenes/compile-week');

  const rows = await db
    .select({ id: weeks.id, weekNumber: weeks.weekNumber, curriculumPackId: weeks.curriculumPackId })
    .from(weeks)
    .where(eq(weeks.status, 'published'));

  if (rows.length === 0) {
    console.log('No published weeks found.');
    return;
  }

  console.log(`Found ${rows.length} published weeks. Recompiling…`);
  let totalLevels = 0;
  for (const w of rows) {
    const n = await compileWeekIntoLevels(w.id);
    console.log(`  week ${w.id} (#${w.weekNumber}) → ${n} levels`);
    totalLevels += n;
  }
  console.log(`Done. ${rows.length} weeks, ${totalLevels} total levels.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
