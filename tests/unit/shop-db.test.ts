import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shopItemRow: null as null | Record<string, unknown>,
  avatarItemRow: null as null | Record<string, unknown>,
  alreadyOwned: false,
  balance: 500,
  awardCoinsInTx: vi.fn(),
  insertCalls: [] as string[],
}));

vi.mock('@/lib/db/coins', () => ({
  awardCoinsInTx: mocks.awardCoinsInTx,
}));

vi.mock('@/db/schema', () => {
  const fakeTable = (name: string) => {
    const t: Record<string, unknown> = { __name: name };
    return t;
  };
  return {
    shopItems: fakeTable('shop_items'),
    shopPurchases: fakeTable('shop_purchases'),
    avatarItems: fakeTable('avatar_items'),
    avatarSlots: fakeTable('avatar_slots'),
    childAvatarEquipped: fakeTable('child_avatar_equipped'),
    childAvatarInventory: fakeTable('child_avatar_inventory'),
    coinBalances: fakeTable('coin_balances'),
  };
});

vi.mock('@/db', () => {
  // Each tx.select returns a chain; we hand-route by call order.
  let selectCallIdx = 0;
  const makeChain = (resolveTo: unknown) => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    chain.from = ret;
    chain.where = ret;
    chain.limit = ret;
    chain.innerJoin = ret;
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(resolveTo));
    return chain;
  };

  const tx = {
    select: vi.fn().mockImplementation(() => {
      selectCallIdx++;
      // Order in purchaseShopItemInTx:
      //  1. select shop_items
      //  2. select avatar_items (linked)
      //  3. select child_avatar_inventory (dupe)
      //  4. select coin_balances (balance check)
      //  5. select coin_balances (final after award)
      if (selectCallIdx === 1) {
        return makeChain(mocks.shopItemRow ? [mocks.shopItemRow] : []);
      }
      if (selectCallIdx === 2) {
        return makeChain(mocks.avatarItemRow ? [mocks.avatarItemRow] : []);
      }
      if (selectCallIdx === 3) {
        return makeChain(
          mocks.alreadyOwned ? [{ childId: 'c1', avatarItemId: 'a1' }] : [],
        );
      }
      return makeChain([{ balance: mocks.balance }]);
    }),
    insert: vi.fn().mockImplementation((table: { __name?: string }) => {
      const tableName = table.__name ?? 'unknown';
      mocks.insertCalls.push(tableName);
      return {
        values: vi.fn().mockReturnValue({
          then: (cb: (v: unknown) => unknown) =>
            Promise.resolve(cb(undefined)),
          onConflictDoNothing: vi.fn().mockReturnValue({
            then: (cb: (v: unknown) => unknown) =>
              Promise.resolve(cb(undefined)),
          }),
        }),
      };
    }),
  };

  const reset = () => {
    selectCallIdx = 0;
  };

  return {
    db: {
      transaction: vi.fn(async (fn) => {
        reset();
        mocks.insertCalls.length = 0;
        return fn(tx);
      }),
    },
  };
});

import { purchaseShopItem } from '@/lib/db/shop';
import {
  AlreadyOwnedError,
  InsufficientCoinsError,
  ShopItemNotFoundError,
} from '@/lib/errors/shop-errors';

beforeEach(() => {
  mocks.shopItemRow = {
    id: 's1',
    slug: 'avatar-hat-tricorn',
    kind: 'avatar',
    name: '海盗三角帽',
    priceCoins: 120,
    isActive: true,
  };
  mocks.avatarItemRow = {
    id: 'a1',
    slotId: 'hat',
    name: '海盗三角帽',
    unlockVia: 'shop',
    unlockRef: 'avatar-hat-tricorn',
  };
  mocks.alreadyOwned = false;
  mocks.balance = 500;
  mocks.awardCoinsInTx.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('purchaseShopItem', () => {
  it('happy path: deducts coins, inserts shop_purchases + inventory, returns coinsAfter', async () => {
    // After awardCoinsInTx is called the balance read returns 380 (500-120).
    mocks.awardCoinsInTx.mockImplementation(async () => {
      mocks.balance = 380;
    });

    const result = await purchaseShopItem('c1', 's1');

    expect(mocks.awardCoinsInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        childId: 'c1',
        delta: -120,
        reason: 'shop_purchase',
        refType: 'shop_item',
        refId: 's1',
      }),
    );
    expect(mocks.insertCalls).toContain('shop_purchases');
    expect(mocks.insertCalls).toContain('child_avatar_inventory');
    expect(result.coinsAfter).toBe(380);
    expect(result.avatarItemId).toBe('a1');
  });

  it('throws ShopItemNotFoundError when the shop_item row is missing or inactive', async () => {
    mocks.shopItemRow = null;
    await expect(purchaseShopItem('c1', 's1')).rejects.toThrow(
      ShopItemNotFoundError,
    );
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });

  it('throws AlreadyOwnedError when the child already owns the linked avatar item', async () => {
    mocks.alreadyOwned = true;
    await expect(purchaseShopItem('c1', 's1')).rejects.toThrow(AlreadyOwnedError);
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });

  it('throws InsufficientCoinsError when balance < priceCoins', async () => {
    mocks.balance = 50;
    await expect(purchaseShopItem('c1', 's1')).rejects.toThrow(
      InsufficientCoinsError,
    );
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
    expect(mocks.insertCalls).not.toContain('shop_purchases');
  });
});
