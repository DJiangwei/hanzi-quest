// Drizzle schema · gacha — PR #52
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

/**
 * Per-child weekly card-grant counter. Resets every UTC Monday.
 * Used by `pullCardForChild` to enforce the 10/wk cap.
 */
export const childCardGrantsWeekly = pgTable(
  'child_card_grants_weekly',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekStartUtc: text('week_start_utc').notNull(), // ISO YYYY-MM-DD of UTC Monday
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.weekStartUtc] })],
);

/**
 * Per-child DAILY card-grant counter (PR card-economy-v2). Replaces the
 * weekly cap. Resets every UTC midnight. Used by `pullCardInTx` to enforce
 * DAILY_CARD_CAP. The older `childCardGrantsWeekly` table is now dead (kept
 * per the append-only migration rule).
 */
export const childCardGrantsDaily = pgTable(
  'child_card_grants_daily',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    dayUtc: text('day_utc').notNull(), // ISO YYYY-MM-DD (UTC)
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.dayUtc] })],
);

/**
 * Idempotency log for card grants. Every (child, source, refId) can grant
 * at most once. Source values: 'boss_clear' | 'perfect_week' | 'story_chapter'.
 * refId: sessionId for boss_clear; weekId for perfect_week; chapterId for story_chapter.
 */
export const cardGrantsLog = pgTable(
  'card_grants_log',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    refId: text('ref_id').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.source, t.refId] })],
);
