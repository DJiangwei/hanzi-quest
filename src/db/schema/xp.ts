import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const childXp = pgTable('child_xp', {
  childId: uuid('child_id').primaryKey().references(() => childProfiles.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const xpEvents = pgTable('xp_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  source: text('source').notNull(),
  refId: text('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
