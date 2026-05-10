// Drizzle schema · collections — see PLAN.md §4
import {
  boolean,
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

export const rarity = pgEnum('rarity', ['common', 'rare', 'epic']);

export const collectionPacks = pgTable('collection_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  themeColor: text('theme_color'),
  isActive: boolean('is_active').notNull().default(true),
  availableFrom: timestamp('available_from', { withTimezone: true }),
  availableTo: timestamp('available_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const collectibleItems = pgTable(
  'collectible_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packId: uuid('pack_id')
      .notNull()
      .references(() => collectionPacks.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    loreZh: text('lore_zh'),
    loreEn: text('lore_en'),
    rarity: rarity('rarity').notNull().default('common'),
    dropWeight: integer('drop_weight').notNull().default(1),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('collectible_items_pack_idx').on(t.packId)],
);

export const childCollections = pgTable(
  'child_collections',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectibleItems.id, { onDelete: 'cascade' }),
    count: integer('count').notNull().default(1),
    firstObtainedAt: timestamp('first_obtained_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.itemId] })],
);

export const shardBalances = pgTable(
  'shard_balances',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    packId: uuid('pack_id')
      .notNull()
      .references(() => collectionPacks.id, { onDelete: 'cascade' }),
    shards: integer('shards').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.packId] })],
);
