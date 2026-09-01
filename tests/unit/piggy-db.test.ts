// The ledger. Note what is NOT here: a 23505 guard. Auto-credits insert with
// .onConflictDoNothing().returning() and read rows.length, because
// creditPiggyInTx runs inside claimSeasonTierInTx's transaction and Postgres
// aborts an entire transaction on any error without a savepoint — a caught
// unique violation would poison the enclosing season claim.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: (...a: unknown[]) => mocks.insert(...a),
    select: (...a: unknown[]) => mocks.select(...a),
    transaction: (...a: unknown[]) => mocks.transaction(...a),
    delete: (...a: unknown[]) => mocks.delete(...a),
  },
}));

import {
  creditPiggy,
  creditPiggyInTx,
  deleteManualEntry,
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

/** A delete chain whose returning() resolves to `rows`. */
function deleteChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    where: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(rows)),
  });
  return chain;
}

/**
 * Renders a drizzle `sql`/condition fragment to its parameterized Postgres
 * text via the real PgDialect — the same technique the reviewer used to catch
 * the `= any((...))` row-constructor bug that a rows-in/rows-out mock can
 * never see, because the mock never actually evaluates the SQL it's handed.
 */
function renderSql(fragment: unknown): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(fragment as SQL);
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

  it('calls onConflictDoNothing() as the idempotency mechanism', async () => {
    const chain = insertChain([{ id: 'e1' }]);
    const tx = { insert: vi.fn(() => chain) } as never;
    await creditPiggyInTx(tx, {
      childId: 'c1', source: 'final_boss', refId: 'p1', pence: 300,
    });
    expect(chain.onConflictDoNothing).toHaveBeenCalled();
  });

  it('propagates a rejected insert rather than swallowing it in a try/catch', async () => {
    // Pins the "never a caught exception" claim: an implementation that
    // wrapped the insert in try/catch and returned { credited: false } on any
    // error would still pass every other test in this block, but would also
    // swallow a REAL failure (a dropped connection, a constraint violation
    // unrelated to the idempotency key) — and inside claimSeasonTierInTx's
    // transaction, that swallow is exactly the poisoning this design avoids
    // by construction rather than by catching.
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      values: vi.fn(() => chain),
      onConflictDoNothing: vi.fn(() => chain),
      returning: vi.fn(() => Promise.reject(new Error('connection reset'))),
    });
    const tx = { insert: vi.fn(() => chain) } as never;
    await expect(
      creditPiggyInTx(tx, {
        childId: 'c1', source: 'boss_clear', refId: 'w1', pence: 100,
      }),
    ).rejects.toThrow('connection reset');
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
    const chain = selectChain([{ total: 1275 }]);
    mocks.select.mockReturnValue(chain);
    await expect(getPiggyBalance('c1')).resolves.toBe(1275);

    // The mock's `total` is a hand-fed number — it doesn't prove the real
    // query sums anything. Render the actual projection fragment the module
    // built and pin its SQL text, so a rewrite that stops summing (or drops
    // the coalesce, reintroducing NULL-for-no-entries) fails this test even
    // though the hand-fed row above would still make it pass.
    const projection = mocks.select.mock.calls[0][0] as { total: unknown };
    expect(renderSql(projection.total).sql).toBe(
      'coalesce(sum("piggy_entries"."delta_pence"), 0)::int',
    );
  });

  it('returns 0 for a child with no entries at all', async () => {
    mocks.select.mockReturnValue(selectChain([{ total: null }]));
    await expect(getPiggyBalance('c1')).resolves.toBe(0);
  });
});

describe('getSpendByCategory', () => {
  it('returns positive magnitudes keyed by category, computed as -sum(delta) over debits only', async () => {
    const chain = selectChain([
      { category: 'snacks', total: 450 },
      { category: 'toys', total: 1200 },
    ]);
    mocks.select.mockReturnValue(chain);
    await expect(getSpendByCategory('c1')).resolves.toEqual({
      snacks: 450,
      toys: 1200,
    });

    // The hand-fed `total` values above are already positive, so they alone
    // can't tell apart `(-sum(delta))::int` from a regression to plain
    // `sum(delta)::int` — both would return the same mocked rows. Render the
    // actual fragment and pin the leading negation.
    const projection = mocks.select.mock.calls[0][0] as { total: unknown };
    expect(renderSql(projection.total).sql).toBe(
      '(-sum("piggy_entries"."delta_pence"))::int',
    );

    // Same hole for the WHERE clause: a mocked row doesn't prove the query is
    // actually scoped to debits (`delta_pence < 0`) with a category
    // (`category is not null`) for this child. Render the real predicate.
    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const rendered = renderSql(whereArg);
    expect(rendered.sql).toBe(
      '("piggy_entries"."child_id" = $1 and "piggy_entries"."delta_pence" < $2 and "piggy_entries"."category" is not null)',
    );
    expect(rendered.params).toEqual(['c1', 0]);
  });

  it('omits categories with no spend rather than emitting a zero bar', async () => {
    mocks.select.mockReturnValue(selectChain([{ category: 'toys', total: 300 }]));
    const out = await getSpendByCategory('c1');
    expect(Object.keys(out)).toEqual(['toys']);
    expect(out).not.toHaveProperty('books');
  });
});

describe('deleteManualEntry', () => {
  it('refuses to delete an auto-earned source', async () => {
    // A real Postgres WHERE (id = $1 AND child_id = $2 AND source IN (...))
    // excludes a boss_clear-sourced row outright — the DB never returns it.
    mocks.delete.mockReturnValue(deleteChain([]));
    await expect(deleteManualEntry('c1', 'entry-boss')).resolves.toBe(false);
  });

  it('refuses to delete a row belonging to a different child', async () => {
    // Same shape: the child_id predicate excludes it at the DB, so
    // returning() comes back empty rather than the module doing its own
    // ownership check after the fact.
    mocks.delete.mockReturnValue(deleteChain([]));
    await expect(deleteManualEntry('someone-else', 'entry-not-theirs')).resolves.toBe(
      false,
    );
  });

  it('deletes a manual-source row and returns true', async () => {
    mocks.delete.mockReturnValue(deleteChain([{ id: 'entry-purchase' }]));
    await expect(deleteManualEntry('c1', 'entry-purchase')).resolves.toBe(true);
  });

  it('scopes the delete via IN over an array — regression guard for the ANY/row-constructor bug', async () => {
    // This is the exact class of bug Finding 1 caught: `sql\`= any(${array})\``
    // renders as a ROW CONSTRUCTOR, not an array, and Postgres rejects it
    // (42809). A rows-in/rows-out mock can't see that difference — only
    // rendering the real WHERE fragment through PgDialect can.
    const chain = deleteChain([{ id: 'entry-purchase' }]);
    mocks.delete.mockReturnValue(chain);
    await deleteManualEntry('c1', 'entry-purchase');

    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const rendered = renderSql(whereArg);
    expect(rendered.sql).toBe(
      '("piggy_entries"."id" = $1 and "piggy_entries"."child_id" = $2 and "piggy_entries"."source" in ($3, $4, $5))',
    );
    expect(rendered.sql).not.toContain('any(');
    expect(rendered.params).toEqual([
      'entry-purchase',
      'c1',
      'parent_credit',
      'purchase',
      'reconcile',
    ]);
  });
});
