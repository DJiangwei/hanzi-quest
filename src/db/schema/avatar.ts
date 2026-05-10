// Drizzle schema · avatar — see PLAN.md §4
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const avatarUnlockVia = pgEnum('avatar_unlock_via', [
  'default',
  'shop',
  'collection',
  'achievement',
]);

export const powerupKind = pgEnum('powerup_kind', [
  'revive',
  'hint',
  'streak_freeze',
]);

export const avatarSlots = pgTable('avatar_slots', {
  id: text('id').primaryKey(),
  displayOrder: smallint('display_order').notNull().default(0),
});

export const avatarItems = pgTable(
  'avatar_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotId: text('slot_id')
      .notNull()
      .references(() => avatarSlots.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    imageUrl: text('image_url'),
    unlockVia: avatarUnlockVia('unlock_via').notNull().default('shop'),
    unlockRef: text('unlock_ref'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('avatar_items_slot_idx').on(t.slotId)],
);

export const childAvatarInventory = pgTable(
  'child_avatar_inventory',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    avatarItemId: uuid('avatar_item_id')
      .notNull()
      .references(() => avatarItems.id, { onDelete: 'cascade' }),
    obtainedAt: timestamp('obtained_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.avatarItemId] })],
);

export const childAvatarEquipped = pgTable(
  'child_avatar_equipped',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    slotId: text('slot_id')
      .notNull()
      .references(() => avatarSlots.id, { onDelete: 'restrict' }),
    avatarItemId: uuid('avatar_item_id').references(() => avatarItems.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [primaryKey({ columns: [t.childId, t.slotId] })],
);

export const powerupInventory = pgTable(
  'powerup_inventory',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    kind: powerupKind('kind').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.kind] })],
);
