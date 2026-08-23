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
  /**
   * Whether this pack participates in gacha (boss/perfect/story pulls) + the
   * weekly 大礼包. Reward-only packs (e.g. festivals-v1, earned solely via the
   * monthly challenge) set this false so their cards never drop from gacha.
   */
  gachaEligible: boolean('gacha_eligible').notNull().default(true),
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

/**
 * Universal (global) shard wallet — one row per child (2026-06-07 economy
 * redesign). Replaces the per-pack `shard_balances` as the live balance:
 * duplicates are manually converted to shards (1 dupe = 1 shard) and 3 shards
 * trade for ANY unowned card from ANY pack. `shard_balances` is now dead but
 * retained (append-only); its balances were summed into here at migration time.
 */
export const childShards = pgTable('child_shards', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: 'cascade' }),
  shards: integer('shards').notNull().default(0),
});

/**
 * Idempotency ledger for the festival Monthly Challenge reward. One row per
 * (child, UTC month) once the active-days goal is met and the festival card is
 * granted. The PK guarantees a child can claim each month's reward only once.
 */
export const festivalChallengeClaims = pgTable(
  'festival_challenge_claims',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    /** `yyyy-mm` of the claimed month. */
    monthKey: text('month_key').notNull(),
    /** The festival card slug granted for that month. */
    cardSlug: text('card_slug').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.monthKey] })],
);

/**
 * Peer-to-peer card gifts (crew gifting, 2026-08-23). Doubles as the ledger AND
 * the unseen-notification queue: the card transfers immediately inside the
 * gifting tx, and `seen_at` is stamped when the recipient opens the chest.
 *
 * `day_utc` is denormalised rather than derived from `sent_at` so the two daily
 * cap checks are plain index scans — same shape as `child_card_grants_daily`.
 */
export const cardGifts = pgTable(
  'card_gifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromChildId: uuid('from_child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    toChildId: uuid('to_child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => collectibleItems.id, { onDelete: 'cascade' }),
    dayUtc: text('day_utc').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    seenAt: timestamp('seen_at', { withTimezone: true }),
  },
  (t) => [
    index('card_gifts_to_unseen_idx').on(t.toChildId, t.seenAt),
    index('card_gifts_from_day_idx').on(t.fromChildId, t.dayUtc),
    index('card_gifts_to_day_idx').on(t.toChildId, t.dayUtc),
  ],
);
