// The ledger. Note what is NOT here: a 23505 guard. Auto-credits insert with
// .onConflictDoNothing().returning() and read rows.length, because
// creditPiggyInTx runs inside claimSeasonTierInTx's transaction and Postgres
// aborts an entire transaction on any error without a savepoint — a caught
// unique violation would poison the enclosing season claim.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: (...a: unknown[]) => mocks.insert(...a),
    select: (...a: unknown[]) => mocks.select(...a),
    transaction: (...a: unknown[]) => mocks.transaction(...a),
  },
}));

import {
  creditPiggy,
  creditPiggyInTx,
  getPiggyBalance,
  getSpendByCategory,
} from '@/lib/db/piggy';

/** An insert chain whose returning() resolves to `rows`. */
function insertChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    values: vi.fn(() => chain),
    onConflictDoNothing: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(rows)),
  });
  return chain;
}

/** A select chain whose terminal await resolves to `rows`. */
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => Promise.resolve(rows)),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
  });
  return chain;
}

beforeEach(() => vi.clearAllMocks());

describe('creditPiggyInTx', () => {
  it('reports credited when the insert produced a row', async () => {
    const tx = { insert: vi.fn(() => insertChain([{ id: 'e1' }])) } as never;
    await expect(
      creditPiggyInTx(tx, {
        childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100,
      }),
    ).resolves.toEqual({ credited: true });
  });

  it('reports NOT credited when the row already existed, without throwing', async () => {
    const tx = { insert: vi.fn(() => insertChain([])) } as never;
    await expect(
      creditPiggyInTx(tx, {
        childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100,
      }),
    ).resolves.toEqual({ credited: false });
  });

  it('uses ON CONFLICT DO NOTHING — never a caught exception', async () => {
    const chain = insertChain([{ id: 'e1' }]);
    const tx = { insert: vi.fn(() => chain) } as never;
    await creditPiggyInTx(tx, {
      childId: 'c1', source: 'final_boss', refId: 'p1', pence: 300,
    });
    expect(chain.onConflictDoNothing).toHaveBeenCalled();
  });
});

describe('creditPiggy', () => {
  it('writes nothing for a child with the piggy bank disabled', async () => {
    mocks.select.mockReturnValue(selectChain([{ enabled: false }]));
    await expect(
      creditPiggy({ childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100 }),
    ).resolves.toEqual({ credited: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('writes nothing for a child that does not exist', async () => {
    mocks.select.mockReturnValue(selectChain([]));
    await expect(
      creditPiggy({ childId: 'ghost', source: 'boss_clear', refId: 'w1', pence: 100 }),
    ).resolves.toEqual({ credited: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('credits when enabled', async () => {
    mocks.select.mockReturnValue(selectChain([{ enabled: true }]));
    mocks.transaction.mockImplementation(
      (fn: (tx: unknown) => unknown) =>
        fn({ insert: () => insertChain([{ id: 'e1' }]) }),
    );
    await expect(
      creditPiggy({ childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100 }),
    ).resolves.toEqual({ credited: true });
  });

  it('refuses a zero-pence credit outright', async () => {
    await expect(
      creditPiggy({ childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 0 }),
    ).resolves.toEqual({ credited: false });
    expect(mocks.select).not.toHaveBeenCalled();
  });
});

describe('getPiggyBalance', () => {
  it('returns the summed delta', async () => {
    mocks.select.mockReturnValue(selectChain([{ total: 1275 }]));
    await expect(getPiggyBalance('c1')).resolves.toBe(1275);
  });

  it('returns 0 for a child with no entries at all', async () => {
    mocks.select.mockReturnValue(selectChain([{ total: null }]));
    await expect(getPiggyBalance('c1')).resolves.toBe(0);
  });
});

describe('getSpendByCategory', () => {
  it('returns positive magnitudes keyed by category', async () => {
    mocks.select.mockReturnValue(
      selectChain([
        { category: 'snacks', total: 450 },
        { category: 'toys', total: 1200 },
      ]),
    );
    await expect(getSpendByCategory('c1')).resolves.toEqual({
      snacks: 450,
      toys: 1200,
    });
  });

  it('omits categories with no spend rather than emitting a zero bar', async () => {
    mocks.select.mockReturnValue(selectChain([{ category: 'toys', total: 300 }]));
    const out = await getSpendByCategory('c1');
    expect(Object.keys(out)).toEqual(['toys']);
    expect(out).not.toHaveProperty('books');
  });
});
