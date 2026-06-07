import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const homePlacements = pgTable('home_placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  room: text('room').notNull(),               // 'bedroom' | 'living' | 'playroom'
  furnitureSlug: text('furniture_slug').notNull(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('home_placements_child_furniture_uq').on(t.childId, t.furnitureSlug)]);
