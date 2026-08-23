// NEVER import this file from client code. It pulls in postgres.
import { and, eq, sql } from 'drizzle-orm';
import { cardGifts, childCollections } from '@/db/schema/collections';
import type { Tx } from '@/lib/db/grants';
import {
  GIFTS_RECEIVED_PER_DAY,
  GIFTS_SENT_PER_DAY,
} from '@/lib/crew/gift-config';

export type GiftOutcome =
  | { ok: true; itemId: string }
  | {
      ok: false;
      reason:
        | 'no_duplicate'
        | 'already_owned'
        | 'send_cap_reached'
        | 'receive_cap_reached'
        | 'self_gift';
    };

/**
 * Move one duplicate collectible card from `fromChildId` to `toChildId`,
 * inside `tx`. Modelled on `convertDuplicateInTx` (`grants.ts`): a
 * `SELECT ... FOR UPDATE` -> check -> decrement shape that never throws for
 * an expected case — every rejection is a `GiftOutcome`, not an exception.
 *
 * Ordering below is load-bearing, not stylistic. The giver's row is locked
 * FIRST and held across every other check: two children tapping "gift" on
 * the same last duplicate at the same moment must not both pass, and only a
 * lock taken before the count is read (and released only once the whole
 * decision — recipient/cap checks included — is final) guarantees that.
 */
export async function giftCardInTx(
  tx: Tx,
  fromChildId: string,
  toChildId: string,
  itemId: string,
  dayUtc: string,
): Promise<GiftOutcome> {
  // 1. Cheapest guard, no IO.
  if (fromChildId === toChildId) {
    return { ok: false, reason: 'self_gift' };
  }

  // 2. Lock the giver's row and hold it across every check below.
  const giverRows = await tx
    .select({ count: childCollections.count })
    .from(childCollections)
    .where(
      and(
        eq(childCollections.childId, fromChildId),
        eq(childCollections.itemId, itemId),
      ),
    )
    .for('update');
  const giverCount = giverRows[0]?.count ?? 0;
  if (giverCount < 2) {
    return { ok: false, reason: 'no_duplicate' };
  }

  // 3. Recipient must not already own it.
  const recipientRows = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(
      and(
        eq(childCollections.childId, toChildId),
        eq(childCollections.itemId, itemId),
      ),
    );
  if (recipientRows.length > 0) {
    return { ok: false, reason: 'already_owned' };
  }

  // 4. Giver's send cap for the day.
  const sentRows = await tx
    .select({ count: sql<number>`count(*)` })
    .from(cardGifts)
    .where(
      and(eq(cardGifts.fromChildId, fromChildId), eq(cardGifts.dayUtc, dayUtc)),
    );
  const sentToday = Number(sentRows[0]?.count ?? 0);
  if (sentToday >= GIFTS_SENT_PER_DAY) {
    return { ok: false, reason: 'send_cap_reached' };
  }

  // 5. Recipient's receive cap for the day.
  const receivedRows = await tx
    .select({ count: sql<number>`count(*)` })
    .from(cardGifts)
    .where(and(eq(cardGifts.toChildId, toChildId), eq(cardGifts.dayUtc, dayUtc)));
  const receivedToday = Number(receivedRows[0]?.count ?? 0);
  if (receivedToday >= GIFTS_RECEIVED_PER_DAY) {
    return { ok: false, reason: 'receive_cap_reached' };
  }

  // 6. Decrement the giver's count by exactly 1. Safe under the lock taken
  //    in step 2 — giverCount was already proven >= 2.
  await tx
    .update(childCollections)
    .set({ count: sql`${childCollections.count} - 1` })
    .where(
      and(
        eq(childCollections.childId, fromChildId),
        eq(childCollections.itemId, itemId),
      ),
    );

  // 7. Additive only — step 3 already proved the recipient has no row for
  //    this item, so this is always a fresh INSERT, never an update or an
  //    upsert. This transaction writes into a child belonging to a
  //    DIFFERENT family; a cross-account write that can only ever add a row
  //    is far easier to reason about than one that can modify. Do not
  //    "improve" this into onConflictDoUpdate — that would silently paper
  //    over a bug in the step-3 check instead of surfacing it.
  await tx
    .insert(childCollections)
    .values({ childId: toChildId, itemId, count: 1 });

  // 8. Ledger row — also the unseen-notification queue (see the table's doc
  //    comment in db/schema/collections.ts).
  await tx.insert(cardGifts).values({ fromChildId, toChildId, itemId, dayUtc });

  return { ok: true, itemId };
}
