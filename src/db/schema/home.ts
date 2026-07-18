import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const homePlacements = pgTable('home_placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  room: text('room').notNull(),               // 'bedroom' | 'living' | 'playroom'
  furnitureSlug: text('furniture_slug').notNull(),
  /** E3 multi-buy: which owned copy (0..cap-1) this placement is. */
  copyIndex: integer('copy_index').notNull().default(0),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('home_placements_child_furniture_copy_uq').on(t.childId, t.furnitureSlug, t.copyIndex)]);

/**
 * The wallpaper + floor equipped per room, per child. Absent row → the room's
 * default surfaces (ROOM_DEFAULT_SURFACES). Equip upserts on (child_id, room).
 */
export const homeRoomSurfaces = pgTable('home_room_surfaces', {
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  room: text('room').notNull(),               // 'bedroom' | 'living' | 'playroom'
  wallpaperSlug: text('wallpaper_slug').notNull(),
  floorSlug: text('floor_slug').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.childId, t.room] })]);
