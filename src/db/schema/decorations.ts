import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const decorations = pgTable(
  'decorations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionZh: text('description_zh'),
    descriptionEn: text('description_en'),
    emoji: text('emoji').notNull(),
    anchorSlug: text('anchor_slug').notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('decorations_display_order_idx').on(t.displayOrder)],
);
