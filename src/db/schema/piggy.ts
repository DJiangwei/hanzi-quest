// Drizzle schema · 存钱罐 piggy bank — real pocket money.
//
// ONE append-only ledger. The balance is SUM(delta_pence) and is deliberately
// NOT stored: a denormalised total drifts from its history, and this number
// has to match a jar the child can physically count. Same rule as 🗝️ keys
// (derived from week_progress) and season XP (derived from xp_events).
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const piggyEntries = pgTable(
  'piggy_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    /** Signed: credits positive, debits negative. One code path per change. */
    deltaPence: integer('delta_pence').notNull(),
    /**
     * PiggySource (src/lib/db/piggy.ts). Plain text, NOT a pgEnum — same
     * choice as card_grants_log.source, so a future source needs no migration.
     */
    source: text('source').notNull(),
    /** PiggyCategory slug. Debits only; null on every credit. */
    category: text('category'),
    note: text('note'),
    /** Idempotency key for auto sources; null on manual entries. */
    refId: text('ref_id'),
    /**
     * When the money actually moved — the parent may log yesterday's purchase,
     * and backfilled entries carry the date they were earned. Every list and
     * chart orders by this; created_at exists only for audit.
     */
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('piggy_entries_child_idx').on(t.childId, t.occurredAt.desc()),
    /**
     * PARTIAL on purpose. Auto-credits are idempotent through this index;
     * manual entries legitimately repeat (two 🍬 purchases in one day are two
     * rows, not a conflict), and they carry ref_id = null so they fall outside
     * it entirely.
     */
    uniqueIndex('piggy_entries_auto_uq')
      .on(t.childId, t.source, t.refId)
      .where(sql`${t.refId} is not null`),
  ],
);
