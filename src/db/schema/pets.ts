import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const pets = pgTable(
  'pets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    emoji: text('emoji').notNull(),
    descriptionZh: text('description_zh'),
    descriptionEn: text('description_en'),
    speechZh: text('speech_zh').array().notNull(),
    speechEn: text('speech_en').array().notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('pets_display_order_idx').on(t.displayOrder)],
);

export const childPetEquipped = pgTable('child_pet_equipped', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: 'cascade' }),
  petId: uuid('pet_id').references(() => pets.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
