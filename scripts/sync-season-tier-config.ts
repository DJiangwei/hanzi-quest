/**
 * Push the TS tier config into a LIVE season row.
 *
 * Why this exists: `seed-season-summer.ts` ends in `onConflictDoNothing()` — on
 * purpose, so a re-run cannot silently re-window a running season. The
 * consequence is that editing `summerVoyage.ts` and re-running the seed does
 * NOT update an existing row's `tier_config`. Without this script the season
 * £ would sit in TypeScript and never reach the row `getActiveSeason` reads.
 *
 * Updates `tier_config` ONLY — never starts_at, ends_at, or is_active.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 *
 * Usage: pnpm tsx scripts/sync-season-tier-config.ts
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }

  const { db } = await import('../src/db');
  const { seasons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { SUMMER_VOYAGE_SLUG, SUMMER_VOYAGE_TIERS } = await import(
    '../src/lib/season/summerVoyage'
  );

  const updated = await db
    .update(seasons)
    .set({ tierConfig: SUMMER_VOYAGE_TIERS })
    .where(eq(seasons.id, SUMMER_VOYAGE_SLUG))
    .returning({ id: seasons.id });

  if (updated.length === 0) {
    console.error(
      `No season row with id '${SUMMER_VOYAGE_SLUG}' — run seed-season-summer.ts first.`,
    );
    process.exit(1);
  }

  const money = SUMMER_VOYAGE_TIERS.filter((t) => t.bonusMoneyPence);
  console.log(
    `Synced ${SUMMER_VOYAGE_TIERS.length} tiers; ${money.length} pay money ` +
      `(${money.reduce((s, t) => s + (t.bonusMoneyPence ?? 0), 0)}p total).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
