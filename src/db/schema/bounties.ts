// T2 通缉令 wanted-character bounties (spec 2026-07-18-wanted-bounties-design).
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { characters } from './content';

export const bountyPosters = pgTable(
  'bounty_posters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    dayUtc: text('day_utc').notNull(), // ISO date, e.g. 2026-07-18
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    required: integer('required').notNull(),
    progress: integer('progress').notNull().default(0),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('bounty_posters_child_day_char_uq').on(
      t.childId,
      t.dayUtc,
      t.characterId,
    ),
  ],
);
