import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { cardGifts, childCollections } from '@/db/schema/collections';

// db is not imported at module load by gifts.ts (giftCardInTx takes `tx`
// directly), but mock it anyway per project convention — a future helper in
// this file that reads outside a tx (like grants.ts's getGlobalShards) would
// otherwise throw "DATABASE_URL is not set" on CI.
vi.mock('@/db', () => ({ db: {} }));

import { giftCardInTx } from '@/lib/db/gifts';
import {
  GIFTS_PER_SENDER_PER_DAY,
  GIFTS_RECEIVED_PER_DAY,
  GIFTS_SENT_PER_DAY,
} from '@/lib/crew/gift-config';

const FROM = 'child-from';
const TO = 'child-to';
const ITEM = 'item-1';
const DAY = '2026-08-23';

/**
 * A `.select().from().where()` chain that resolves `resolveValue` whether or
 * not `.for('update')` is chained on afterward — mirrors how giftCardInTx's
 * giver-lock select awaits `.for('update')` while its other selects await
 * the `.where(...)` result directly.
 */
function makeSelectChain(resolveValue: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const fromSpy = vi.fn(() => chain);
  const whereSpy = vi.fn(() => chain);
  const forSpy = vi.fn(() => Promise.resolve(resolveValue));
  chain.from = fromSpy;
  chain.where = whereSpy;
  chain.for = forSpy;
  chain.then = (resolve: (v: unknown) => void) => resolve(resolveValue);
  return { chain, fromSpy, whereSpy, forSpy };
}

/**
 * Builds a fake `tx` that hands out a FRESH chain per call to `select`, in
 * the exact order `giftCardInTx` is expected to issue them: giver lock ->
 * recipient ownership -> giver's send-today count -> per-sender
 * (toChildId+fromChildId) count -> global received-today count. Each
 * chain's spies can be asserted individually and their
 * `mock.invocationCallOrder` compared for ordering.
 */
function makeTx(opts: {
  giverCount: number;
  recipientOwns?: boolean;
  sentToday?: number;
  fromSenderToday?: number;
  receivedToday?: number;
}) {
  const giver = makeSelectChain([{ count: opts.giverCount }]);
  const recipient = makeSelectChain(
    opts.recipientOwns ? [{ itemId: ITEM }] : [],
  );
  const sent = makeSelectChain([{ count: opts.sentToday ?? 0 }]);
  const fromSender = makeSelectChain([{ count: opts.fromSenderToday ?? 0 }]);
  const received = makeSelectChain([{ count: opts.receivedToday ?? 0 }]);

  const selectSpy = vi.fn();
  selectSpy
    .mockReturnValueOnce(giver.chain)
    .mockReturnValueOnce(recipient.chain)
    .mockReturnValueOnce(sent.chain)
    .mockReturnValueOnce(fromSender.chain)
    .mockReturnValueOnce(received.chain);

  const updateWhereSpy = vi.fn().mockResolvedValue(undefined);
  const setSpy = vi.fn(() => ({ where: updateWhereSpy }));
  const updateSpy = vi.fn(() => ({ set: setSpy }));

  const insertCollectionsValuesSpy = vi.fn().mockResolvedValue(undefined);
  const insertGiftsValuesSpy = vi.fn().mockResolvedValue(undefined);
  const insertSpy = vi
    .fn()
    .mockReturnValueOnce({ values: insertCollectionsValuesSpy })
    .mockReturnValueOnce({ values: insertGiftsValuesSpy });

  const tx = { select: selectSpy, update: updateSpy, insert: insertSpy };

  return {
    tx,
    giver,
    recipient,
    sent,
    fromSender,
    received,
    selectSpy,
    updateSpy,
    setSpy,
    updateWhereSpy,
    insertSpy,
    insertCollectionsValuesSpy,
    insertGiftsValuesSpy,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('giftCardInTx', () => {
  it('fromChildId === toChildId -> self_gift, with NO IO at all', async () => {
    const { tx, selectSpy, updateSpy, insertSpy } = makeTx({ giverCount: 2 });

    const r = await giftCardInTx(tx as never, FROM, FROM, ITEM, DAY);

    expect(r).toEqual({ ok: false, reason: 'self_gift' });
    expect(selectSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('count === 1 -> no_duplicate, and nothing is written', async () => {
    const { tx, giver, selectSpy, updateSpy, insertSpy } = makeTx({
      giverCount: 1,
    });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: false, reason: 'no_duplicate' });
    // Only the giver-lock select ran — no recipient/cap checks, no writes.
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(giver.whereSpy).toHaveBeenCalledWith(
      and(
        eq(childCollections.childId, FROM),
        eq(childCollections.itemId, ITEM),
      ),
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('recipient already owns it -> already_owned, giver unchanged', async () => {
    const { tx, recipient, selectSpy, updateSpy, insertSpy } = makeTx({
      giverCount: 2,
      recipientOwns: true,
    });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: false, reason: 'already_owned' });
    expect(selectSpy).toHaveBeenCalledTimes(2);
    expect(recipient.whereSpy).toHaveBeenCalledWith(
      and(eq(childCollections.childId, TO), eq(childCollections.itemId, ITEM)),
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('giver at GIFTS_SENT_PER_DAY -> send_cap_reached', async () => {
    const { tx, sent, selectSpy, updateSpy, insertSpy } = makeTx({
      giverCount: 2,
      recipientOwns: false,
      sentToday: GIFTS_SENT_PER_DAY,
    });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: false, reason: 'send_cap_reached' });
    expect(selectSpy).toHaveBeenCalledTimes(3);
    expect(sent.whereSpy).toHaveBeenCalledWith(
      and(eq(cardGifts.fromChildId, FROM), eq(cardGifts.dayUtc, DAY)),
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // The design flaw this replaces: GIFTS_RECEIVED_PER_DAY used to be checked
  // globally as the ONLY receive-side gate, so one generous sender could
  // exhaust a recipient's whole daily inbox and lock out every other
  // sender — an ordinary accident in a crew where several kids all want to
  // gift the same friend, not griefing. The per-sender cap below is now the
  // check that actually defends the collecting loop.
  it('same sender gifting the same recipient twice same day -> already_gifted_today, nothing written', async () => {
    const { tx, fromSender, selectSpy, updateSpy, insertSpy } = makeTx({
      giverCount: 2,
      recipientOwns: false,
      sentToday: 0,
      fromSenderToday: GIFTS_PER_SENDER_PER_DAY,
    });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: false, reason: 'already_gifted_today' });
    // giver lock, recipient ownership, send cap, per-sender check — the
    // global backstop select must NOT have run.
    expect(selectSpy).toHaveBeenCalledTimes(4);
    expect(fromSender.whereSpy).toHaveBeenCalledWith(
      and(
        eq(cardGifts.toChildId, TO),
        eq(cardGifts.fromChildId, FROM),
        eq(cardGifts.dayUtc, DAY),
      ),
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // This is the exact case the old global-only cap got wrong: a DIFFERENT
  // sender gifting a recipient who already received a card today (from
  // someone else) must still succeed, as long as the global backstop isn't
  // hit. Per-sender gating is per (toChildId, fromChildId) — a different
  // fromChildId starts its own count at zero.
  it('a different sender gifting the same recipient the same day still succeeds', async () => {
    // Some other child already gave TO a card today (reflected in
    // `receivedToday: 1`, well under the backstop), but THIS gift is from
    // FROM — a different sender. The per-sender check is scoped by
    // (toChildId, fromChildId), so FROM's own count today is 0 regardless
    // of what that other sender already sent.
    const { tx, fromSender } = makeTx({
      giverCount: 2,
      recipientOwns: false,
      sentToday: 0,
      fromSenderToday: 0,
      receivedToday: 1,
    });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: true, itemId: ITEM });
    // The per-sender check that ran was scoped to THIS sender (FROM), not
    // OTHER_SENDER — proving the gate is per-sender, not shared.
    expect(fromSender.whereSpy).toHaveBeenCalledWith(
      and(
        eq(cardGifts.toChildId, TO),
        eq(cardGifts.fromChildId, FROM),
        eq(cardGifts.dayUtc, DAY),
      ),
    );
  });

  it('global backstop still fires at GIFTS_RECEIVED_PER_DAY', async () => {
    const { tx, received, selectSpy, updateSpy, insertSpy } = makeTx({
      giverCount: 2,
      recipientOwns: false,
      sentToday: 0,
      fromSenderToday: 0,
      receivedToday: GIFTS_RECEIVED_PER_DAY,
    });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: false, reason: 'receive_cap_reached' });
    expect(selectSpy).toHaveBeenCalledTimes(5);
    expect(received.whereSpy).toHaveBeenCalledWith(
      and(eq(cardGifts.toChildId, TO), eq(cardGifts.dayUtc, DAY)),
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('happy path: giver -1, recipient inserted with count 1, one card_gifts row', async () => {
    const { tx, updateSpy, setSpy, updateWhereSpy, insertSpy, insertCollectionsValuesSpy, insertGiftsValuesSpy } =
      makeTx({
        giverCount: 2,
        recipientOwns: false,
        sentToday: 0,
        fromSenderToday: 0,
        receivedToday: 0,
      });

    const r = await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    expect(r).toEqual({ ok: true, itemId: ITEM });

    // Giver decremented by exactly 1, scoped to (fromChildId, itemId).
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({ count: sql`${childCollections.count} - 1` });
    expect(updateWhereSpy).toHaveBeenCalledWith(
      and(
        eq(childCollections.childId, FROM),
        eq(childCollections.itemId, ITEM),
      ),
    );

    // Recipient row is a plain INSERT (additive only), count: 1.
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(insertCollectionsValuesSpy).toHaveBeenCalledWith({
      childId: TO,
      itemId: ITEM,
      count: 1,
    });

    // Ledger row with the right dayUtc.
    expect(insertGiftsValuesSpy).toHaveBeenCalledWith({
      fromChildId: FROM,
      toChildId: TO,
      itemId: ITEM,
      dayUtc: DAY,
    });
  });

  it('takes FOR UPDATE on the giver row, before any of the cap-check selects', async () => {
    const { tx, giver, sent, fromSender, received } = makeTx({
      giverCount: 2,
      recipientOwns: false,
      sentToday: 0,
      fromSenderToday: 0,
      receivedToday: 0,
    });

    await giftCardInTx(tx as never, FROM, TO, ITEM, DAY);

    // The lock was actually taken.
    expect(giver.forSpy).toHaveBeenCalledWith('update');

    // And it happened strictly before all three cap-check selects even
    // began building their WHERE clause — the lock must be held across the
    // whole decision, not just the initial read.
    const lockOrder = giver.forSpy.mock.invocationCallOrder[0];
    const sentCheckOrder = sent.whereSpy.mock.invocationCallOrder[0];
    const fromSenderCheckOrder = fromSender.whereSpy.mock.invocationCallOrder[0];
    const receivedCheckOrder = received.whereSpy.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(sentCheckOrder);
    expect(lockOrder).toBeLessThan(fromSenderCheckOrder);
    expect(lockOrder).toBeLessThan(receivedCheckOrder);
  });
});
