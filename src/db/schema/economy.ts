// Drizzle schema · economy — see PLAN.md §4
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const coinReason = pgEnum('coin_reason', [
  'scene_complete',
  'scene_replay',
  'scene_perfect_bonus',
  'boss_clear',
  'streak_daily',
  'shop_purchase',
  'gacha_pull',
  'shard_redeem',
  'admin_adjust',
]);

export const shopItemKind = pgEnum('shop_item_kind', [
  'avatar',
  'powerup',
  'consumable',
  'pack_voucher',
]);

export const coinBalances = pgTable('coin_balances', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const coinTransactions = pgTable(
  'coin_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: coinReason('reason').notNull(),
    refType: text('ref_type'),
    refId: text('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('coin_txn_child_idx').on(t.childId),
    index('coin_txn_child_created_idx').on(t.childId, t.createdAt),
  ],
);

export const shopItems = pgTable(
  'shop_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    kind: shopItemKind('kind').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    priceCoins: integer('price_coins').notNull(),
    availableFrom: timestamp('available_from', { withTimezone: true }),
    availableTo: timestamp('available_to', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('shop_items_kind_idx').on(t.kind)],
);

export const shopPurchases = pgTable(
  'shop_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    shopItemId: uuid('shop_item_id')
      .notNull()
      .references(() => shopItems.id, { onDelete: 'restrict' }),
    coinsSpent: integer('coins_spent').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('shop_purchases_child_idx').on(t.childId)],
);

export const gachaPulls = pgTable(
  'gacha_pulls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    packId: uuid('pack_id').notNull(),
    costCoins: integer('cost_coins').notNull().default(0),
    isFree: boolean('is_free').notNull().default(false),
    resultItemId: uuid('result_item_id').notNull(),
    wasDuplicate: boolean('was_duplicate').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('gacha_pulls_child_idx').on(t.childId),
    index('gacha_pulls_pack_idx').on(t.packId),
  ],
);
