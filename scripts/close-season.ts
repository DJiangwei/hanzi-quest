/**
 * Close a season: flip `seasons.is_active` to false for one season id.
 *
 * **Why this script has to exist.** Nothing else could end a season. The seed
 * scripts end in `.onConflictDoNothing()` (deliberate — a re-run must never
 * re-window a live season) and `sync-season-tier-config.ts` updates
 * `tier_config` ONLY, never the window or the flag. So retiring a season meant
 * a hand-written UPDATE against production, and predictably it never happened:
 * 夏季航海 ended 2026-08-08 and was still `is_active = true` four weeks later,
 * with the home banner advertising it the whole time.
 *
 * Closing the OUTGOING season is step one of any launch, before the new row
 * exists — two active rows is a state `getActiveSeason` now orders through
 * deterministically, but not one to create on purpose.
 *
 * Nothing is lost by closing: `syncSeasonProgress` banks every reached-but-
 * unclaimed tier once the window has passed, and season XP is derived from
 * `xp_events`, so a closed season's history stays intact and re-openable.
 *
 * Usage:
 *   pnpm tsx scripts/close-season.ts                      # list seasons, close nothing
 *   SEASON_ID=summer-voyage-2026 pnpm tsx scripts/close-season.ts
 *   SEASON_ID=... FORCE=1 pnpm tsx scripts/close-season.ts # allow closing a season still running
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm which branch you
 * are pointed at before running.
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');

  const { db } = await import('../src/db');
  const { seasons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const all = await db
    .select({
      id: seasons.id,
      nameZh: seasons.nameZh,
      startsAt: seasons.startsAt,
      endsAt: seasons.endsAt,
      isActive: seasons.isActive,
    })
    .from(seasons);

  const day = (d: Date) => d.toISOString().slice(0, 10);
  console.log('seasons:');
  for (const s of all) {
    const over = Date.now() > s.endsAt.getTime();
    console.log(
      `  ${s.isActive ? '● active  ' : '○ closed  '}${s.id}  ${s.nameZh}  ${day(s.startsAt)} → ${day(
        s.endsAt,
      )}${over ? '  (window has passed)' : ''}`,
    );
  }

  const id = process.env.SEASON_ID;
  if (!id) {
    console.log('\nSEASON_ID not set — listed only, nothing changed.');
    return;
  }

  const target = all.find((s) => s.id === id);
  if (!target) throw new Error(`no season with id "${id}"`);
  if (!target.isActive) {
    console.log(`\n${id} is already closed — nothing to do.`);
    return;
  }
  // Closing a RUNNING season strands tiers: the end-of-season sweep only fires
  // once the window has passed, and it reads `getActiveSeason`, which will no
  // longer return this row. Refuse unless the caller says they mean it.
  if (Date.now() <= target.endsAt.getTime() && !process.env.FORCE) {
    throw new Error(
      `${id} is still running (ends ${day(target.endsAt)}). ` +
        'Closing it now would strand every unclaimed tier, because the ' +
        'end-of-season sweep reads getActiveSeason. Re-run with FORCE=1 if ' +
        'that is genuinely what you want.',
    );
  }

  await db.update(seasons).set({ isActive: false }).where(eq(seasons.id, id));
  console.log(`\nclosed ${id}. getActiveSeason will no longer return it.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
