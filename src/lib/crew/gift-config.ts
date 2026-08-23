/**
 * Crew gifting caps. PURE + CLIENT-SAFE by contract: no `@/db`, no
 * `@/lib/db/*` imports — the UI imports this directly to show "X/Y today".
 *
 * The send cap and the per-sender cap are what actually protect the
 * collecting loop from a crew funnelling every duplicate into one
 * collection. The global receive figure is only a backstop for a larger
 * crew than we expect — see `GIFTS_PER_SENDER_PER_DAY`'s comment for why it
 * can't be the primary bound.
 */

/** A giver may send this many gifts per UTC day, across all recipients. */
export const GIFTS_SENT_PER_DAY = 2;

/**
 * A recipient accepts at most this many gifts per UTC day FROM ANY ONE SENDER.
 *
 * This, not the global cap below, is what stops a crew funnelling every
 * duplicate into one collection: no single child can dump their whole daily
 * allowance on one friend. Making it per-sender rather than global also removes
 * a bad interaction — a global cap let one child consume the slots another
 * child's friend needed, so the mechanic could block the very exchange it
 * exists to encourage.
 */
export const GIFTS_PER_SENDER_PER_DAY = 1;

/** Absolute daily inflow ceiling, a backstop for a larger crew than we expect. */
export const GIFTS_RECEIVED_PER_DAY = 5;
