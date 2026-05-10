// Drizzle schema · system — see PLAN.md §4
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const aiJobKind = pgEnum('ai_job_kind', [
  'generate_week',
  'regenerate_char',
  'generate_sentence',
]);

export const aiJobStatus = pgEnum('ai_job_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
]);

export const aiJobs = pgTable(
  'ai_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: aiJobKind('kind').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    status: aiJobStatus('status').notNull().default('queued'),
    model: text('model'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    costUsd: numeric('cost_usd', { precision: 10, scale: 4 }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('ai_jobs_status_idx').on(t.status),
    index('ai_jobs_kind_idx').on(t.kind),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    diff: jsonb('diff'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorUserId),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
  ],
);
