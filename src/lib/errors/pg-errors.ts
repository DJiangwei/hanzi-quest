// Pure, client-safe Postgres error predicates. NO db imports — a test for this
// file must not need `vi.mock('@/db')`.

/** SQLSTATE for a unique/primary-key violation. */
const UNIQUE_VIOLATION = '23505';

/** Depth guard: a wrapper chain is 1–2 links in practice, and `cause` can cycle. */
const MAX_CAUSE_DEPTH = 8;

/**
 * True when `err` is (or wraps) a Postgres unique-violation — the "this row
 * already exists" signal every idempotency guard in this codebase keys off.
 *
 * **Why this walks `cause` instead of reading `err.code`.** drizzle-orm wraps
 * EVERY driver error in `DrizzleQueryError` (see `pg-core/session.js`), a class
 * carrying `query` / `params` / `cause` but NO `code`. A guard written as
 * `'code' in err && err.code === '23505'` therefore NEVER matches in
 * production: it rethrows, the surrounding transaction rolls back, and an
 * expected duplicate turns into a failed server action. All six of this
 * codebase's guards shipped with that bug and none of their tests caught it —
 * every one threw a bare `{ code: '23505' }`, a shape production never
 * produces. If you write a new guard, call this; don't re-derive the check.
 */
export function isUniqueViolation(err: unknown): boolean {
  return hasSqlState(err, UNIQUE_VIOLATION);
}

function hasSqlState(err: unknown, sqlState: string): boolean {
  let current = err;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object' || current === null) return false;
    if (seen.has(current)) return false;
    seen.add(current);
    if ('code' in current && (current as { code?: unknown }).code === sqlState) {
      return true;
    }
    if (!('cause' in current)) return false;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
