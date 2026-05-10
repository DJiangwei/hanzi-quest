// Drizzle schema · game — see PLAN.md §4
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { weeks } from './content';

export const sceneType = pgEnum('scene_type', [
  'flashcard',
  'audio_pick',
  'visual_pick',
  'image_pick',
  'word_match',
  'tracing',
  'boss',
]);

export const sceneTemplates = pgTable(
  'scene_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: sceneType('type').notNull(),
    version: smallint('version').notNull().default(1),
    defaultConfig: jsonb('default_config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('scene_templates_type_idx').on(t.type)],
);

export const weekLevels = pgTable(
  'week_levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    sceneTemplateId: uuid('scene_template_id')
      .notNull()
      .references(() => sceneTemplates.id, { onDelete: 'restrict' }),
    sceneConfig: jsonb('scene_config').notNull().default({}),
    unlockedAfterPosition: smallint('unlocked_after_position'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('week_levels_week_idx').on(t.weekId),
    index('week_levels_week_position_idx').on(t.weekId, t.position),
  ],
);

export const playSessions = pgTable(
  'play_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    device: text('device'),
    sessionSummary: jsonb('session_summary'),
  },
  (t) => [index('play_sessions_child_idx').on(t.childId)],
);

export const sceneAttempts = pgTable(
  'scene_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    weekLevelId: uuid('week_level_id')
      .notNull()
      .references(() => weekLevels.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    correctCount: integer('correct_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    hintsUsed: integer('hints_used').notNull().default(0),
    score: integer('score').notNull().default(0),
    coinsAwarded: integer('coins_awarded').notNull().default(0),
  },
  (t) => [
    index('scene_attempts_session_idx').on(t.sessionId),
    index('scene_attempts_level_idx').on(t.weekLevelId),
  ],
);

export const weekProgress = pgTable(
  'week_progress',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    completionPercent: smallint('completion_percent').notNull().default(0),
    bossCleared: boolean('boss_cleared').notNull().default(false),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    totalTimeSeconds: integer('total_time_seconds').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.weekId] })],
);

export const streaks = pgTable('streaks', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastPlayedDate: date('last_played_date'),
  freezeTokens: integer('freeze_tokens').notNull().default(0),
});
