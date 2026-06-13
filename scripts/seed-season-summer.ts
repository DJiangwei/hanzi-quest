/**
 * Seed the 夏季航海 / Summer Voyage season row (`seasons`).
 *
 * Usage:
 *   pnpm tsx scripts/seed-season-summer.ts
 *
 * Idempotent: upserts by PK `id`. Re-running keeps the original start/end window
 * (onConflictDoNothing) so it won't silently re-window a live season.
 *
 * Seeds the season LIVE NOW (starts_at = now, ends_at = +8 weeks). The tier config
 * comes from `src/lib/season/summerVoyage.ts` — the single source of truth — so the
 * JSONB and the typed config can never drift.
 *
 * RUN ORDER: seed-season-cards.ts + seed-festival-avatar-items.ts + seed-trophies.ts
 * must run BEFORE this (the tiers reference those cards / cosmetics / trophy).
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
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
  const { SUMMER_VOYAGE_META, SUMMER_VOYAGE_TIERS } = await import(
    '../src/lib/season/summerVoyage'
  );

  const startsAt = new Date(); // live now
  const endsAt = new Date(startsAt.getTime() + 56 * 86_400_000); // +8 weeks

  await db
    .insert(seasons)
    .values({
      id: SUMMER_VOYAGE_META.id,
      nameZh: SUMMER_VOYAGE_META.nameZh,
      nameEn: SUMMER_VOYAGE_META.nameEn,
      themeEmoji: SUMMER_VOYAGE_META.themeEmoji,
      startsAt,
      endsAt,
      tierConfig: SUMMER_VOYAGE_TIERS,
      isActive: true,
    })
    .onConflictDoNothing();

  console.log(
    `seeded season ${SUMMER_VOYAGE_META.id}: ${startsAt.toISOString().slice(0, 10)} → ${endsAt
      .toISOString()
      .slice(0, 10)} (${SUMMER_VOYAGE_TIERS.length} tiers)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
