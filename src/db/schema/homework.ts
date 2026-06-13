import { index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { weeks } from './content';

export const homeworkItemType = pgEnum('homework_item_type', [
  'char_quiz',
  'word_building',
  'sentence_order',
]);

export const homeworkItems = pgTable(
  'homework_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Homework is PER-CHILD (2026-06-13): each account's homework is private to
    // its own child, so it never leaks across accounts on a shared pack week.
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    type: homeworkItemType('type').notNull(),
    config: jsonb('config').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('homework_items_child_week_idx').on(t.childId, t.weekId)],
);
