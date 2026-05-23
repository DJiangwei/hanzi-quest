import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const trophyCategory = pgEnum('trophy_category', [
  'mastery',
  'streak',
  'collection',
  'coins',
  'practice',
]);

export const trophies = pgTable(
  'trophies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionZh: text('description_zh').notNull(),
    descriptionEn: text('description_en').notNull(),
    loreZh: text('lore_zh'),
    loreEn: text('lore_en'),
    emoji: text('emoji').notNull(),
    category: trophyCategory('category').notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('trophies_category_idx').on(t.category, t.displayOrder)],
);

export const childTrophies = pgTable(
  'child_trophies',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    trophyId: uuid('trophy_id')
      .notNull()
      .references(() => trophies.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.childId, t.trophyId] }),
    index('child_trophies_child_idx').on(t.childId, t.earnedAt),
  ],
);
