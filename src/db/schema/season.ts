import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

/**
 * One active season at a time. `tier_config` holds the typed SeasonTier[] (see
 * src/lib/season/types.ts) as JSONB. Season XP is DERIVED at read time (sum of
 * xp_events in the [starts_at, ends_at] window) — never stored.
 */
export const seasons = pgTable('seasons', {
  id: text('id').primaryKey(), // slug, e.g. 'summer-voyage-2026'
  nameZh: text('name_zh').notNull(),
  nameEn: text('name_en').notNull(),
  themeEmoji: text('theme_emoji').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  tierConfig: jsonb('tier_config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-child claim state. Only the set of claimed tiers is persisted; the current
 * tier + claimable set are derived from season XP at read time.
 */
export const childSeasonProgress = pgTable(
  'child_season_progress',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id),
    tiersClaimed: integer('tiers_claimed').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.seasonId] })],
);
