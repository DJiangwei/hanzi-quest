/**
 * Crew gifting caps. PURE + CLIENT-SAFE by contract: no `@/db`, no
 * `@/lib/db/*` imports — the UI imports this directly to show "X/Y today".
 *
 * Both caps exist because unlimited gifting lets a crew funnel every
 * duplicate into one child's collection and collapses the collecting loop
 * the whole game is built on. They are independent: the send cap bounds any
 * one child's generosity, the receive cap bounds inflow regardless of how
 * many people are sending.
 */

/** A giver may send this many gifts per UTC day. */
export const GIFTS_SENT_PER_DAY = 2;

/** A recipient may receive this many gifts per UTC day. */
export const GIFTS_RECEIVED_PER_DAY = 3;
