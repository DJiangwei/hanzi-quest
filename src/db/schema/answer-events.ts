// Per-answer learning telemetry (write-only in v1).
// See docs/superpowers/specs/2026-07-03-answer-events-and-flashcard-self-assessment-design.md
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { characters, weeks, words } from './content';

export const answerEvents = pgTable(
  'answer_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id').references(() => weeks.id, { onDelete: 'set null' }),
    // 'review' | 'practice' | 'boss' | 'homework' | 'study' — text (not pgEnum),
    // validated app-side; future sources need no migration.
    source: text('source').notNull(),
    sceneType: text('scene_type').notNull(),
    characterId: uuid('character_id').references(() => characters.id, { onDelete: 'set null' }),
    wordId: uuid('word_id').references(() => words.id, { onDelete: 'set null' }),
    itemKey: text('item_key'),
    correct: boolean('correct'),
    selfRating: text('self_rating'),
    pickedKey: text('picked_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('answer_events_child_char_idx').on(t.childId, t.characterId),
    index('answer_events_child_time_idx').on(t.childId, t.createdAt),
  ],
);
