/**
 * Seed the 里海远航 / Caspian Passage season row (`seasons`).
 *
 * Read `docs/season-runbook.md` first — the run ORDER matters, because the
 * tiers reference cards, cosmetics and a trophy by slug and
 * `claimSeasonTierInTx` resolves them at claim time:
 *
 *   1. scripts/seed-season-cards.ts        (the 5 Caspian cards)
 *   2. scripts/seed-festival-avatar-items.ts  (the 8 Caspian cosmetics)
 *   3. scripts/seed-trophies.ts            (season-caspian-master)
 *   4. SEASON_ID=summer-voyage-2026 scripts/close-season.ts   ← BEFORE this
 *   5. this script
 *   6. scripts/verify-integrity.ts
 *
 * **`starts_at` is NOW, deliberately not backdated.** Season XP is DERIVED by
 * summing `xp_events` over [starts_at, ends_at], so the start date decides
 * retroactively what counts. Production held 1,785 XP (Yinuo) and 150 (小板)
 * earned since 夏季航海 ended on 2026-08-08; backdating would have handed
 * Yinuo roughly fifteen tiers on day one. David's call, made explicitly.
 *
 * 12 weeks, not 8 — see the runbook's cadence section.
 *
 * Idempotent: `.onConflictDoNothing()`, so a re-run can never re-window a live
 * season. To change the tier table afterwards, run
 * `scripts/sync-season-tier-config.ts` — re-running THIS script will not.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm the branch first.
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

/** 12 weeks. Quarterly cadence — see docs/season-runbook.md. */
const SEASON_DAYS = 84;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');

  const { db } = await import('../src/db');
  const { seasons } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { CASPIAN_VOYAGE_META, CASPIAN_VOYAGE_TIERS } = await import(
    '../src/lib/season/caspianVoyage'
  );

  // Two active rows is a state `getActiveSeason` now orders through
  // deterministically (startsAt desc), but not one to create on purpose.
  const stillOpen = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.isActive, true));
  const others = stillOpen.filter((s) => s.id !== CASPIAN_VOYAGE_META.id);
  if (others.length > 0) {
    throw new Error(
      `close these first (scripts/close-season.ts): ${others.map((s) => s.id).join(', ')}`,
    );
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + SEASON_DAYS * 86_400_000);

  await db
    .insert(seasons)
    .values({
      id: CASPIAN_VOYAGE_META.id,
      nameZh: CASPIAN_VOYAGE_META.nameZh,
      nameEn: CASPIAN_VOYAGE_META.nameEn,
      themeEmoji: CASPIAN_VOYAGE_META.themeEmoji,
      startsAt,
      endsAt,
      tierConfig: CASPIAN_VOYAGE_TIERS,
      isActive: true,
    })
    .onConflictDoNothing();

  console.log(
    `seeded season ${CASPIAN_VOYAGE_META.id}: ${startsAt.toISOString().slice(0, 10)} → ${endsAt
      .toISOString()
      .slice(0, 10)} (${CASPIAN_VOYAGE_TIERS.length} tiers, not backdated)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
