import { boolean, integer, pgTable, primaryKey, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const dailyQuests = pgTable('daily_quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),       // UTC YYYY-MM-DD
  questId: text('quest_id').notNull(),
  progress: integer('progress').notNull().default(0),
  target: integer('target').notNull(),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('daily_quests_child_date_quest_uq').on(t.childId, t.date, t.questId)]);

export const dailyQuestChests = pgTable('daily_quest_chests', {
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  coins: integer('coins').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.childId, t.date] })]);
