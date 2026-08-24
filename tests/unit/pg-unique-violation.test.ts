// Every "already granted / already claimed" guard in this codebase keys off a
// Postgres unique violation (SQLSTATE 23505). drizzle-orm wraps EVERY driver
// error in `DrizzleQueryError` (pg-core/session.js), which carries
// query/params/cause but NO `code` — so a guard that tests `err.code` directly
// never matches in production. These tests use the REAL wrapped shape observed
// in prod logs, not a bare `{ code: '23505' }` object that production never
// produces.
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

describe('pullCardInTx', () => {
  it('returns already_granted instead of throwing when the grant log row exists', async () => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ for: vi.fn().mockResolvedValue([{ count: 3 }]) })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => {
          throw wrappedUniqueViolation();
        }),
      })),
    } as never;

    const result = await pullCardInTx(tx, 'child-1', 'review', '2026-08-21', '2026-08-21');

    expect(result).toEqual({ granted: false, reason: 'already_granted', cardsToday: 3 });
  });
});

describe('grantGiftPackInTx', () => {
  it('returns already_granted instead of throwing when this week is already claimed', async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => {
          throw wrappedUniqueViolation();
        }),
      })),
      select: vi.fn(),
      update: vi.fn(),
    } as never;

    const result = await grantGiftPackInTx(tx, 'child-1', '2026-08-17', () => 0.1);

    expect(result).toEqual({ granted: false, reason: 'already_granted' });
  });
});
