// NEVER import this file from client code. It pulls in postgres.
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  cardGifts,
  childCollections,
  collectibleItems,
  collectionPacks,
} from '@/db/schema/collections';
import type { Tx } from '@/lib/db/grants';
import { nicknameFor } from '@/lib/crew/nickname';
import type { RevealCard } from '@/lib/play/reveal-card';
import {
  GIFTS_PER_SENDER_PER_DAY,
  GIFTS_RECEIVED_PER_DAY,
  GIFTS_SENT_PER_DAY,
} from '@/lib/crew/gift-config';

/**
 * How many gifts `childId` has already sent today (any recipient) — the
 * read-side counterpart of step 4 inside `giftCardInTx`, used to render
 * "N gifts left today" BEFORE the child taps a crewmate. Not
 * transactional and not authoritative: `giftCardInTx` re-checks the real
 * cap under `SELECT ... FOR UPDATE` at send time, so a stale read here can
 * only make the UI's number briefly optimistic, never let an extra gift
 * through.
 */
export async function countGiftsSentToday(
  childId: string,
  dayUtc: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(cardGifts)
    .where(and(eq(cardGifts.fromChildId, childId), eq(cardGifts.dayUtc, dayUtc)));
  return Number(rows[0]?.count ?? 0);
}

export type GiftOutcome =
  | { ok: true; itemId: string }
  | {
      ok: false;
      reason:
        | 'no_duplicate'
        | 'already_owned'
        | 'send_cap_reached'
        | 'already_gifted_today'
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

  // 5a. Per-sender cap: how many THIS sender has already given THIS
  //     recipient today. This — not the global backstop below — is the
  //     check that actually stops a crew funnelling every duplicate into
  //     one collection, because it bounds each sender individually rather
  //     than the recipient's inbox as a whole. A global-only cap let one
  //     generous child consume the slots a different child's friend needed,
  //     blocking the very exchange the feature exists to create.
  const fromSenderTodayRows = await tx
    .select({ count: sql<number>`count(*)` })
    .from(cardGifts)
    .where(
      and(
        eq(cardGifts.toChildId, toChildId),
        eq(cardGifts.fromChildId, fromChildId),
        eq(cardGifts.dayUtc, dayUtc),
      ),
    );
  const fromSenderToday = Number(fromSenderTodayRows[0]?.count ?? 0);
  if (fromSenderToday >= GIFTS_PER_SENDER_PER_DAY) {
    return { ok: false, reason: 'already_gifted_today' };
  }

  // 5b. Global backstop: absolute inflow ceiling regardless of who's
  //     sending. Not the primary defence (see 5a) — just a ceiling for a
  //     larger crew than we expect today.
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

/** An unseen gift, with everything the reveal needs and nothing more. */
export interface UnseenGift {
  giftId: string;
  /** The giver's generated pirate nickname. NEVER their displayName. */
  from: { zh: string; en: string };
  card: RevealCard;
}

/**
 * Gifts that have arrived but not yet been opened.
 *
 * The card already transferred inside `giftCardInTx` — this queue exists only so
 * the recipient gets a moment of ceremony rather than silently finding a new
 * card in their Backpack. `seen_at` is stamped when they open the chest.
 *
 * The giver is identified by `nicknameFor(from_child_id)` alone. Their real name
 * is never selected, never joined, and cannot reach the payload — the same
 * contract `listCrewMates` holds.
 */
export async function listUnseenGifts(childId: string): Promise<UnseenGift[]> {
  const rows = await db
    .select({
      giftId: cardGifts.id,
      fromChildId: cardGifts.fromChildId,
      itemId: collectibleItems.id,
      slug: collectibleItems.slug,
      packSlug: collectionPacks.slug,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh,
      loreEn: collectibleItems.loreEn,
    })
    .from(cardGifts)
    .innerJoin(collectibleItems, eq(collectibleItems.id, cardGifts.itemId))
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(and(eq(cardGifts.toChildId, childId), isNull(cardGifts.seenAt)))
    .orderBy(asc(cardGifts.sentAt));

  return rows.map((r) => ({
    giftId: r.giftId,
    from: nicknameFor(r.fromChildId),
    card: {
      id: r.itemId,
      slug: r.slug,
      packSlug: r.packSlug,
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      loreZh: r.loreZh,
      loreEn: r.loreEn,
      // A gift is always a card the recipient did not own — giftCardInTx
      // rejects `already_owned` — so it is never a duplicate, and shards are
      // not part of this path.
      isDupe: false,
      shardsAfter: 0,
    },
  }));
}

/** Stamp gifts as opened. Scoped by childId so a caller cannot clear another's. */
export async function markGiftsSeen(childId: string, giftIds: string[]): Promise<void> {
  if (giftIds.length === 0) return;
  await db
    .update(cardGifts)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(cardGifts.toChildId, childId),
        inArray(cardGifts.id, giftIds),
        isNull(cardGifts.seenAt),
      ),
    );
}
