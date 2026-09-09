import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above top-level `const`/`let` declarations,
// so a factory that closes over a plain top-level `const` throws a TDZ
// ReferenceError at import time (verified — see task-4-report.md). The repo's
// own sibling action tests (e.g. shop-outcome.test.ts) work around this with
// vi.hoisted(); same fix applied here, same assertions as the brief's spec.
const mocks = vi.hoisted(() => ({
  purchaseInTx: vi.fn(),
  placeInTx: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
}));
const { purchaseInTx, placeInTx, transaction } = mocks;

vi.mock('@/db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('@/lib/db/shop', () => ({ purchaseShopItemInTx: mocks.purchaseInTx }));
vi.mock('@/lib/db/home', () => ({ placeFurnitureInTx: mocks.placeInTx }));
vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async () => ({ child: { id: 'c1' } })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { buyAndPlaceFurnitureAction } from '@/lib/actions/home';
import { InsufficientCoinsError } from '@/lib/errors/shop-errors';
import { CellOccupiedError } from '@/lib/errors/home-errors';

beforeEach(() => {
  purchaseInTx.mockReset().mockResolvedValue({ shopItemId: 's1', coinsAfter: 10 });
  placeInTx.mockReset().mockResolvedValue(undefined);
  transaction.mockClear();
});

describe('buyAndPlaceFurnitureAction', () => {
  it('purchases BEFORE placing — the ownership check reads the new row', async () => {
    const order: string[] = [];
    purchaseInTx.mockImplementation(async () => { order.push('buy'); return { shopItemId: 's1', coinsAfter: 10 }; });
    placeInTx.mockImplementation(async () => { order.push('place'); });

    await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 0, 's1');
    expect(order).toEqual(['buy', 'place']);
  });

  it('lets a placement failure reject the whole transaction, so the purchase rolls back', async () => {
    placeInTx.mockRejectedValue(new CellOccupiedError('bedroom', 2, 3));
    const out = await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 0, 's1');
    expect(out).toEqual({ status: 'occupied' });
    // The purchase ran, but inside the same transaction that then rejected —
    // asserting only the message would pass even if they were separate txs.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(purchaseInTx).toHaveBeenCalledTimes(1);
  });

  it('maps insufficient coins to an outcome rather than throwing', async () => {
    purchaseInTx.mockRejectedValue(new InsufficientCoinsError(680, 100));
    const out = await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 0, 's1');
    expect(out).toMatchObject({ status: 'insufficient' });
    expect(placeInTx).not.toHaveBeenCalled();
  });

  it('skips the purchase entirely when shopItemId is null (placing an owned copy)', async () => {
    const out = await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 1, null);
    expect(purchaseInTx).not.toHaveBeenCalled();
    expect(placeInTx).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ status: 'placed' });
  });
});

describe('the error handling stays OUTSIDE the transaction', () => {
  it('has no catch between db.transaction( and its closing paren', async () => {
    // Structural, deliberately not behavioural. A mocked @/db cannot reproduce
    // Postgres abort semantics, so moving this catch inside the callback still
    // passes every behavioural test here — verified. But inside the callback a
    // catch cannot stop the transaction's own rejection escaping, and it would
    // defeat the rollback the whole design rests on: a rejected cell must
    // refund by construction, never by compensation. Same class as CLAUDE.md's
    // in-transaction landmine, and pinned the same way logError's test pins
    // its import.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/actions/home.ts', 'utf8');
    const fnStart = src.indexOf('export async function buyAndPlaceFurnitureAction');
    expect(fnStart, 'buyAndPlaceFurnitureAction not found').toBeGreaterThan(-1);

    // Find the db.transaction call with purchaseShopItemInTx — unique to this function
    const fnEnd = src.indexOf('\nexport', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd);
    const txCall = fnStart + fnBody.indexOf('await db.transaction(async (tx) => {');
    expect(txCall, 'db.transaction(async (tx) => not found in buyAndPlaceFurnitureAction').toBeGreaterThanOrEqual(fnStart);

    // Walk parens from `db.transaction(` to its match.
    let depth = 0;
    let end = -1;
    for (let i = src.indexOf('(', txCall); i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    expect(end, 'unbalanced parens after db.transaction(').toBeGreaterThan(txCall);

    const insideTx = src.slice(txCall, end);
    expect(insideTx, 'a catch inside db.transaction() cannot roll back — move it out')
      .not.toContain('catch');

    const afterTx = src.slice(end, end + 400);
    expect(afterTx, 'the catch that maps the outcome must follow the transaction')
      .toContain('catch');
  });
});
