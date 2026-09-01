// Idempotency guards in this codebase come in TWO shapes, and the difference is
// positional, not stylistic:
//
//   OUTSIDE a transaction (a bare `db.insert`, or a try/catch wrapping
//   `db.transaction`) → catching the violation works. `isUniqueViolation` must
//   walk drizzle's `cause` chain, because DrizzleQueryError carries
//   query/params/cause but NO `code` (PR #159). Tested here with the REAL
//   wrapped shape, never a bare `{ code: '23505' }` production never produces.
//
//   INSIDE someone else's transaction (a `*InTx` helper handed a `tx`) →
//   catching CANNOT work. postgres.js aborts the transaction on the first
//   failed statement and rejects the whole `db.transaction()` with the raw
//   driver error, whatever the callback did with it. Those guards use
//   `.onConflictDoNothing().returning()` so no error is ever raised. Asserted
//   below by pinning that onConflictDoNothing is actually called — reverting
//   one to try/catch fails the test.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { wrappedUniqueViolation } from './helpers/pg-error';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  grantSpecificCardInTx: vi.fn().mockResolvedValue(undefined),
  awardCoins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db', () => ({
  db: {
    insert: (...args: unknown[]) => mocks.insert(...args),
    select: (...args: unknown[]) => mocks.select(...args),
    transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));
vi.mock('@/lib/db/admin-grants', () => ({ grantSpecificCardInTx: mocks.grantSpecificCardInTx }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: mocks.awardCoins, awardCoinsInTx: vi.fn() }));

import { isUniqueViolation } from '@/lib/errors/pg-errors';
import { recordFinalBossClear } from '@/lib/db/final-boss';
import { claimKeyVaultPrize } from '@/lib/db/key-vault';
import { pullCardInTx, grantGiftPackInTx } from '@/lib/db/grants';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.grantSpecificCardInTx.mockResolvedValue(undefined);
  mocks.awardCoins.mockResolvedValue(undefined);
});

describe('isUniqueViolation', () => {
  it('matches the drizzle-wrapped shape production actually throws', () => {
    expect(isUniqueViolation(wrappedUniqueViolation())).toBe(true);
  });

  it('still matches a bare driver error carrying the code directly', () => {
    expect(isUniqueViolation(Object.assign(new Error('dup'), { code: '23505' }))).toBe(true);
  });

  it('does not match a different SQLSTATE', () => {
    const pgError = Object.assign(new Error('deadlock'), { code: '40P01' });
    expect(isUniqueViolation(new DrizzleQueryError('q', [], pgError))).toBe(false);
  });

  it('does not match an ordinary error, null, or a string', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });

  it('terminates on a self-referential cause chain', () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(isUniqueViolation(cyclic)).toBe(false);
  });
});

describe('recordFinalBossClear', () => {
  it('reports firstClear:false instead of throwing when the clear row already exists', async () => {
    mocks.insert.mockReturnValue({
      values: vi.fn(() => {
        throw wrappedUniqueViolation();
      }),
    });

    await expect(recordFinalBossClear('child-1', 'pack-1')).resolves.toEqual({
      firstClear: false,
    });
  });

  it('still propagates a non-unique-violation failure', async () => {
    mocks.insert.mockReturnValue({
      values: vi.fn(() => {
        throw new DrizzleQueryError('q', [], new Error('connection lost'));
      }),
    });

    await expect(recordFinalBossClear('child-1', 'pack-1')).rejects.toThrow();
  });
});

describe('claimKeyVaultPrize', () => {
  function stubItemLookup() {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() =>
        Promise.resolve([
          {
            id: 'item-1',
            slug: 'caribbean-treasure',
            nameZh: '加勒比宝藏',
            nameEn: 'Caribbean Treasure',
            loreZh: null,
            loreEn: null,
          },
        ]),
      ),
    });
    mocks.select.mockReturnValue(chain);
  }

  it('returns an empty prize instead of throwing when the vault was already opened', async () => {
    stubItemLookup();
    mocks.transaction.mockRejectedValue(wrappedUniqueViolation());

    await expect(
      claimKeyVaultPrize('child-1', 'pack-1', 'pirate-class-level-1'),
    ).resolves.toEqual({ card: null, coins: 0 });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });
});

describe('pullCardInTx (inside a transaction → ON CONFLICT, never a catch)', () => {
  function txWithConflict(rows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(rows);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ for: vi.fn().mockResolvedValue([{ count: 3 }]) })),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing })) })),
    } as never;
    return { tx, onConflictDoNothing, returning };
  }

  it('returns already_granted when the insert conflicts, with NO error raised', async () => {
    const { tx } = txWithConflict([]); // conflict → nothing returned
    const result = await pullCardInTx(tx, 'child-1', 'review', '2026-08-21', '2026-08-21');
    expect(result).toEqual({ granted: false, reason: 'already_granted', cardsToday: 3 });
  });

  it('uses ON CONFLICT DO NOTHING — a try/catch here could not work', async () => {
    // Regression pin. This guard runs inside the caller's transaction, where a
    // caught violation still rejects the transaction, so the mechanism itself
    // is the thing under test.
    const { tx, onConflictDoNothing } = txWithConflict([]);
    await pullCardInTx(tx, 'child-1', 'review', '2026-08-21', '2026-08-21');
    expect(onConflictDoNothing).toHaveBeenCalled();
  });
});

describe('grantGiftPackInTx (inside a transaction → ON CONFLICT, never a catch)', () => {
  it('returns already_granted when this week is already claimed, with NO error raised', async () => {
    const onConflictDoNothing = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([]),
    }));
    const tx = {
      insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing })) })),
      select: vi.fn(),
      update: vi.fn(),
    } as never;

    const result = await grantGiftPackInTx(tx, 'child-1', '2026-08-17', () => 0.1);

    expect(result).toEqual({ granted: false, reason: 'already_granted' });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });
});

