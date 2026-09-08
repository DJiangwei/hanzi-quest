/**
 * Recompile every published week across all curriculum packs so PR #30's
 * 4-segment structure and new scene types take effect on existing weeks.
 *
 * Usage:
 *   pnpm tsx scripts/recompile-all-weeks.ts                      # every pack
 *   ONLY_PACK=pirate-class-level-2 pnpm tsx scripts/...          # one map
 *   ONLY_PACK=… ONLY_WEEKS=7,10 pnpm tsx scripts/...             # named weeks
 *
 * SCOPE IT when you can. A recompile re-picks every slot's words, so an
 * unscoped run rewrites the questions in weeks the child is part-way
 * through — progress survives (stable level keys) but the questions under
 * her change. Scoping also keeps a content fix on the map it belongs to.
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
  const { weeks, curriculumPacks } = await import('../src/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');
  const { compileWeekIntoLevels } = await import('../src/lib/scenes/compile-week');

  const onlyPack = process.env.ONLY_PACK;
  const onlyWeeks = process.env.ONLY_WEEKS
    ? process.env.ONLY_WEEKS.split(',').map((n) => Number(n.trim()))
    : null;
  if (onlyWeeks?.some((n) => !Number.isInteger(n))) {
    console.error(`ONLY_WEEKS must be integers, got "${process.env.ONLY_WEEKS}"`);
    process.exit(2);
  }

  let packId: string | null = null;
  if (onlyPack) {
    const [pack] = await db
      .select({ id: curriculumPacks.id })
      .from(curriculumPacks)
      .where(eq(curriculumPacks.slug, onlyPack));
    // Fail loudly. A typo'd slug silently matching nothing would print
    // "No published weeks found" and exit 0 — a recompile you believe ran.
    if (!pack) {
      console.error(`ONLY_PACK="${onlyPack}" matched no curriculum pack.`);
      process.exit(2);
    }
    packId = pack.id;
  }

  const rows = await db
    .select({ id: weeks.id, weekNumber: weeks.weekNumber })
    .from(weeks)
    .where(
      and(
        eq(weeks.status, 'published'),
        ...(packId ? [eq(weeks.curriculumPackId, packId)] : []),
        ...(onlyWeeks ? [inArray(weeks.weekNumber, onlyWeeks)] : []),
      ),
    );

  const scope = [onlyPack ?? 'all packs', onlyWeeks ? `weeks ${onlyWeeks.join(',')}` : 'all weeks'];
  console.log(`Scope: ${scope.join(' · ')}`);

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
