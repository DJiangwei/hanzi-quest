// Drizzle schema · content — see PLAN.md §4
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles, users } from './auth';

export const scriptKind = pgEnum('script_kind', [
  'simplified',
  'traditional',
]);

export const characterSource = pgEnum('character_source', [
  'curated',
  'school',
  'ai_generated',
]);

export const weekStatus = pgEnum('week_status', [
  'draft',
  'ai_generating',
  'awaiting_review',
  'published',
  'archived',
]);

export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hanzi: text('hanzi').notNull(),
    script: scriptKind('script').notNull().default('simplified'),
    pinyinArray: text('pinyin_array').array().notNull(),
    meaningEn: text('meaning_en'),
    meaningZh: text('meaning_zh'),
    strokeCount: smallint('stroke_count'),
    frequencyRank: integer('frequency_rank'),
    imageUrl: text('image_url'),
    audioUrl: text('audio_url'),
    source: characterSource('source').notNull().default('ai_generated'),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('characters_hanzi_script_unique').on(t.hanzi, t.script)],
);

export const words = pgTable('words', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  script: scriptKind('script').notNull().default('simplified'),
  pinyinArray: text('pinyin_array').array().notNull(),
  meaningEn: text('meaning_en'),
  audioUrl: text('audio_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const characterWord = pgTable(
  'character_word',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    wordId: uuid('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.wordId] })],
);

export const exampleSentences = pgTable('example_sentences', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  pinyinArray: text('pinyin_array').array().notNull(),
  meaningEn: text('meaning_en'),
  audioUrl: text('audio_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const characterSentence = pgTable(
  'character_sentence',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    sentenceId: uuid('sentence_id')
      .notNull()
      .references(() => exampleSentences.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.sentenceId] })],
);

export const curriculumPacks = pgTable(
  'curriculum_packs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(false),
    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('curriculum_packs_slug_owner_unique').on(t.slug, t.ownerUserId),
    index('curriculum_packs_owner_idx').on(t.ownerUserId),
  ],
);

export const weeks = pgTable(
  'weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentUserId: text('parent_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    curriculumPackId: uuid('curriculum_pack_id')
      .notNull()
      .references(() => curriculumPacks.id, { onDelete: 'restrict' }),
    weekNumber: integer('week_number').notNull(),
    label: text('label').notNull(),
    status: weekStatus('status').notNull().default('draft'),
    notes: text('notes'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('weeks_child_idx').on(t.childId),
    index('weeks_status_idx').on(t.status),
    uniqueIndex('weeks_child_week_unique').on(t.childId, t.weekNumber),
  ],
);

export const weekCharacters = pgTable(
  'week_characters',
  {
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'restrict' }),
    position: smallint('position').notNull(),
    parentNotes: text('parent_notes'),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.characterId] })],
);
