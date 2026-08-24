// Shared builder for the ONE error shape production actually throws on a
// duplicate key.
//
// Why this exists: for months, three suites simulated a unique violation by
// throwing a bare `{ code: '23505' }`. Production never produces that shape —
// drizzle-orm wraps every driver error in `DrizzleQueryError`, which has no
// `code` at the top level — so those tests passed while all six idempotency
// guards were broken in prod. Build the error here, never inline, so a guard
// test can only ever assert against the real thing.
import { DrizzleQueryError } from 'drizzle-orm/errors';

/**
 * A drizzle-wrapped Postgres unique violation, matching the shape observed in
 * production logs (`Failed query: …` with the pg error under `cause`).
 */
export function wrappedUniqueViolation(
  constraint = 'card_grants_log_child_id_source_ref_id_pk',
): Error {
  const pgError = Object.assign(
    new Error('duplicate key value violates unique constraint'),
    { code: '23505', severity: 'ERROR', constraint_name: constraint },
  );
  return new DrizzleQueryError(
    'insert into "card_grants_log" ("child_id", "source", "ref_id") values ($1, $2, $3)',
    ['child-1', 'review', '2026-08-21'],
    pgError,
  );
}
