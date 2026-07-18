/**
 * Tests for purchaseShopItemInTx with kind='home'.
 * Generic (non-avatar) purchase path: coin debit + shop_purchases row; no inventory side-effect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shopItemRow: null as null | Record<string, unknown>,
  ownedRows: 0,
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
    powerupInventory: fakeTable('powerup_inventory'),
  };
});

vi.mock('@/db', () => {
  // Select call routing for the generic (home/decor/pet/sound_theme) path:
  //   1. select shop_items        → shopItemRow
  //   2. select shop_purchases    → already-owned check (empty = not owned)
  //   3. select coin_balances     → balance for debit check
  //   4. select coin_balances     → final balance after award
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
      if (selectCallIdx === 1) {
        return makeChain(mocks.shopItemRow ? [mocks.shopItemRow] : []);
      }
      if (selectCallIdx === 2) {
        // shop_purchases ownership check (E3 multi-buy: row count vs copy cap)
        return makeChain(
          Array.from({ length: mocks.ownedRows }, (_, i) => ({ id: `p${i}` })),
        );
      }
      // calls 3+ → coin_balances
      return makeChain([{ balance: mocks.balance }]);
    }),
    insert: vi.fn().mockImplementation((table: { __name?: string }) => {
      const tableName = table.__name ?? 'unknown';
      mocks.insertCalls.push(tableName);
      return {
        values: vi.fn().mockReturnValue({
          then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
          onConflictDoNothing: vi.fn().mockReturnValue({
            then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
          }),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
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
    id: 's-home-1',
    slug: 'bed-cozy',
    kind: 'home',
    name: '温馨小床',
    priceCoins: 300,
    isActive: true,
    metadata: { rarity: 'rare', category: 'furniture' },
  };
  mocks.ownedRows = 0;
  mocks.balance = 500;
  mocks.awardCoinsInTx.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('purchaseShopItem — home kind', () => {
  it('happy path: debits coins and writes shop_purchases row', async () => {
    mocks.awardCoinsInTx.mockImplementation(async () => {
      mocks.balance = 200; // 500 - 300
    });

    const result = await purchaseShopItem('child-1', 's-home-1');

    expect(mocks.awardCoinsInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        childId: 'child-1',
        delta: -300,
        reason: 'shop_purchase',
        refType: 'shop_item',
        refId: 's-home-1',
      }),
    );
    // Generic path: shop_purchases row written, NO avatar inventory row
    expect(mocks.insertCalls).toContain('shop_purchases');
    expect(mocks.insertCalls).not.toContain('child_avatar_inventory');
    expect(result.coinsAfter).toBe(200);
    expect(result.avatarItemId).toBeNull();
  });

  it('throws ShopItemNotFoundError when item is missing', async () => {
    mocks.shopItemRow = null;
    await expect(purchaseShopItem('child-1', 's-home-1')).rejects.toThrow(
      ShopItemNotFoundError,
    );
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });

  it('E3 multi-buy: an owned furniture item can be bought again below the cap', async () => {
    mocks.ownedRows = 1;
    const result = await purchaseShopItem('child-1', 's-home-1');
    expect(result).toMatchObject({ shopItemId: 's-home-1' });
  });

  it('throws AlreadyOwnedError at the furniture copy cap', async () => {
    mocks.ownedRows = 3; // HOME_FURNITURE_COPY_CAP
    await expect(purchaseShopItem('child-1', 's-home-1')).rejects.toThrow(
      AlreadyOwnedError,
    );
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });

  it('throws InsufficientCoinsError when balance is too low', async () => {
    mocks.balance = 100; // less than 300
    await expect(purchaseShopItem('child-1', 's-home-1')).rejects.toThrow(
      InsufficientCoinsError,
    );
    expect(mocks.insertCalls).not.toContain('shop_purchases');
  });
});
