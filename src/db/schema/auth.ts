// Drizzle schema · auth — see PLAN.md §4 (users, child_profiles)
import {
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { curriculumPacks } from './content';

export const userRole = pgEnum('user_role', ['parent', 'admin']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  role: userRole('role').notNull().default('parent'),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const childProfiles = pgTable('child_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentUserId: text('parent_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  avatarConfig: jsonb('avatar_config').notNull().default({}),
  birthYear: smallint('birth_year'),
  currentCurriculumPackId: uuid('current_curriculum_pack_id').references(
    () => curriculumPacks.id,
    { onDelete: 'set null' },
  ),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const parentSettings = pgTable('parent_settings', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  parentPinHash: text('parent_pin_hash').notNull(),
  pinSetAt: timestamp('pin_set_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  failedAttempts: smallint('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});
