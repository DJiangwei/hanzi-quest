// Crew gifting — the SECOND deliberate cross-account write path in this
// codebase (the first is assertAdmin). These tests exist to prove three
// properties, in this order of importance:
//   1. the GIVER is proven to belong to the caller (requireChild) BEFORE any
//      other database statement runs;
//   2. nothing about the recipient — who belongs to a different family —
//      comes back in the result, so the action can't be used as an oracle;
//   3. the verified child id, not the client's claim, is what reaches the tx.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  childExists: vi.fn(),
  giftCardInTx: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

const FAKE_TX = { __tx: true };

// A test that loads a `@/lib/actions/*` module which transitively imports a
// `@/lib/db/*` module MUST mock `@/db`, or it throws "DATABASE_URL is not
// set" on CI only (local .env.local hides it).
vi.mock('@/db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/crew', () => ({ childExists: mocks.childExists }));
vi.mock('@/lib/db/gifts', () => ({ giftCardInTx: mocks.giftCardInTx }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-08-23' }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { giftCardAction } from '@/lib/actions/crew';

/** The id `requireChild` VERIFIES — the only id allowed to reach the tx. */
const VERIFIED_FROM = 'c-from-verified';
/** What a caller CLAIMS. Deliberately different, so a test can tell them apart. */
const CLAIMED_FROM = 'c-from-claimed';
const TO = 'c-to';
const ITEM = 'item-1';

/**
 * The recipient belongs to another family, so their row carries a real name.
 * The leak test mocks the recipient lookup to resolve THIS OBJECT (truthy, so
 * the action proceeds exactly as with `true`) precisely so a name is actually
 * in scope inside the action — a `true`-only fixture would prove nothing.
 */
const RECIPIENT_ROW = { id: TO, displayName: 'Another Family Kid' };

function input(over: Partial<{ fromChildId: string; toChildId: string; itemId: string }> = {}) {
  return { fromChildId: CLAIMED_FROM, toChildId: TO, itemId: ITEM, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: VERIFIED_FROM } });
  mocks.childExists.mockResolvedValue(true);
  mocks.giftCardInTx.mockResolvedValue({ ok: true, itemId: ITEM });
  mocks.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(FAKE_TX));
});

describe('giftCardAction — the giver gate', () => {
  it('rejects when requireChild rejects, and attempts NO write at all', async () => {
    mocks.requireChild.mockRejectedValue(new Error('Child not found for parent'));

    await expect(giftCardAction(input())).rejects.toThrow(/not found/i);

    // "It threw" alone does not prove no write was attempted.
    expect(mocks.giftCardInTx).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('gates the giver BEFORE looking the recipient up (no existence oracle)', async () => {
    mocks.requireChild.mockRejectedValue(new Error('Child not found for parent'));

    await expect(giftCardAction(input())).rejects.toThrow();

    // A recipient lookup before the gate would let any signed-in stranger
    // probe whether an arbitrary child id exists.
    expect(mocks.childExists).not.toHaveBeenCalled();
  });

  it('gates on the CLAIMED giver id, so requireChild is what rejects a foreign child', async () => {
    await giftCardAction(input({ fromChildId: 'someone-elses-child' }));
    expect(mocks.requireChild).toHaveBeenCalledWith('someone-elses-child');
  });

  it('rejects empty ids before anything runs', async () => {
    await expect(giftCardAction(input({ fromChildId: '' }))).rejects.toThrow();
    expect(mocks.requireChild).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe('giftCardAction — the recipient', () => {
  it('returns recipient_not_found and opens no transaction for an unknown recipient', async () => {
    mocks.childExists.mockResolvedValue(false);

    const result = await giftCardAction(input());

    expect(result).toEqual({ ok: false, reason: 'recipient_not_found' });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.giftCardInTx).not.toHaveBeenCalled();
  });

  it('checks the recipient the caller named', async () => {
    await giftCardAction(input());
    expect(mocks.childExists).toHaveBeenCalledWith(TO);
  });
});

describe('giftCardAction — what reaches the transaction', () => {
  it('forwards the VERIFIED child id, never the raw input', async () => {
    await giftCardAction(input());

    expect(mocks.giftCardInTx).toHaveBeenCalledTimes(1);
    const args = mocks.giftCardInTx.mock.calls[0];
    expect(args[0]).toBe(FAKE_TX); // runs inside the transaction
    expect(args[1]).toBe(VERIFIED_FROM);
    expect(args[1]).not.toBe(CLAIMED_FROM);
    expect(args[2]).toBe(TO);
    expect(args[3]).toBe(ITEM);
    expect(args[4]).toBe('2026-08-23');
  });

  it("revalidates the VERIFIED giver's collection", async () => {
    await giftCardAction(input());
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/play/${VERIFIED_FROM}/collection`);
  });

  it('returns the tx success outcome unchanged', async () => {
    const result = await giftCardAction(input());
    expect(result).toEqual({ ok: true, itemId: ITEM });
  });
});

describe('giftCardAction — tx reasons pass through unchanged', () => {
  const REASONS = [
    'no_duplicate',
    'already_owned',
    'send_cap_reached',
    'receive_cap_reached',
    'self_gift',
  ] as const;

  for (const reason of REASONS) {
    it(`passes ${reason} through`, async () => {
      mocks.giftCardInTx.mockResolvedValue({ ok: false, reason });
      const result = await giftCardAction(input());
      expect(result).toEqual({ ok: false, reason });
    });
  }
});

describe('giftCardAction — the result is not an oracle', () => {
  it("returns nothing about the recipient, not even their name", async () => {
    // Recipient lookup resolves a full row WITH a real name in it, so there
    // is something to leak. Truthy => the action proceeds normally.
    mocks.childExists.mockResolvedValue(RECIPIENT_ROW);

    const result = await giftCardAction(input());

    const json = JSON.stringify(result);
    expect(json).not.toContain(RECIPIENT_ROW.displayName);
    // Not even the recipient's id or nickname — the caller supplied the id
    // and already rendered the nickname from it.
    expect(json).not.toContain(TO);
    expect(Object.keys(result).sort()).toEqual(['itemId', 'ok']);
  });

  it('a rejection reason reveals nothing about the recipient either', async () => {
    mocks.childExists.mockResolvedValue(RECIPIENT_ROW);
    mocks.giftCardInTx.mockResolvedValue({ ok: false, reason: 'already_owned' });

    const result = await giftCardAction(input());

    expect(Object.keys(result).sort()).toEqual(['ok', 'reason']);
    expect(JSON.stringify(result)).not.toContain(RECIPIENT_ROW.displayName);
  });
});
