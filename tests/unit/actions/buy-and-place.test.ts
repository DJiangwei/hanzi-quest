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
