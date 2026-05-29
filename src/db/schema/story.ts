import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { weeks } from './content';

export const storyTone = pgEnum('story_tone', [
  'triumphant',
  'standard',
  'narrow_escape',
]);

export const storyChapters = pgTable(
  'story_chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    bodyZh: text('body_zh').notNull(),
    bodyEn: text('body_en').notNull(),
    summaryForNext: text('summary_for_next').notNull(),
    tone: storyTone('tone').notNull(),
    bossScorePct: integer('boss_score_pct').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('story_chapters_child_week_unique').on(t.childId, t.weekId),
    index('story_chapters_child_created_idx').on(t.childId, t.createdAt),
    check(
      'story_chapters_boss_score_range',
      sql`${t.bossScorePct} BETWEEN 0 AND 100`,
    ),
  ],
);
