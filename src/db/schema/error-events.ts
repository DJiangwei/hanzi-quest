// C3 — server-side error log, browsable at /admin/errors.
//
// Deliberately NOT a third-party service: error payloads in this app can carry
// a childId and learning content, and this is a game for two families. Keeping
// the log inside the deployment means nothing about a child leaves it. The
// trade-off, chosen knowingly, is that there is no alerting — someone has to
// open the page.
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const errorEvents = pgTable(
  'error_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The existing `[prefix]` convention from the console.error call sites,
    // e.g. 'finishAttemptAction'. Text, not an enum: a new call site must not
    // need a migration.
    scope: text('scope').notNull(),
    message: text('message').notNull(),
    stack: text('stack'),
    // Which child hit it, when the call site knows. Nullable — plenty of
    // failures (webhooks, authoring) have no child.
    childId: uuid('child_id').references(() => childProfiles.id, {
      onDelete: 'set null',
    }),
    // Small structured extras. IDs and primitives ONLY — never a display name;
    // /admin/errors is visible across accounts.
    context: jsonb('context'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('error_events_time_idx').on(t.createdAt),
    index('error_events_scope_time_idx').on(t.scope, t.createdAt),
  ],
);
