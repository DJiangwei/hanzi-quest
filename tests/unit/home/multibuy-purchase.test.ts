// E3 multi-buy — purchase-side cap: home FURNITURE up to 3 copies,
// wallpapers/floors and every other generic kind stay own-1.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  existingPurchaseRows: 0,
  balance: 10_000,
  awardCoinsInTx: vi.fn().mockResolvedValue(undefined),
  purchaseInserted: false,
}));

vi.mock('@/db/schema', () => {
  const t = (name: string) => ({ __name: name });
  return {
    shopItems: t('shop_items'),
    shopPurchases: t('shop_purchases'),
    avatarItems: t('avatar_items'),
    avatarSlots: t('avatar_slots'),
    childAvatarEquipped: t('child_avatar_equipped'),
    childAvatarInventory: t('child_avatar_inventory'),
    coinBalances: t('coin_balances'),
    powerupInventory: t('powerup_inventory'),
    childProfiles: t('child_profiles'),
  };
});
vi.mock('@/lib/db/coins', () => ({ awardCoinsInTx: state.awardCoinsInTx }));

vi.mock('@/db', () => {
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {};
    const ret = () => c;
    for (const m of ['from', 'where', 'innerJoin', 'limit']) c[m] = ret;
    c.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(data));
    return c;
  };
  let idx = 0;
  const tx = {
    select: vi.fn().mockImplementation(() => {
      idx++;
      // purchaseShopItemInTx select order for the generic path:
      //   1 = shop_items row (provided by the test via mockShopItem)
      //   2 = existing shop_purchases rows
      //   3 = coin_balances (debit check)
      //   4 = coin_balances (final read)
      if (idx === 1) return chain(mockShopItem ? [mockShopItem] : []);
      if (idx === 2)
        return chain(
          Array.from({ length: state.existingPurchaseRows }, (_, i) => ({ id: `p${i}` })),
        );
      return chain([{ balance: state.balance }]);
    }),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => {
        state.purchaseInserted = true;
        return {
          then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
          onConflictDoNothing: vi.fn().mockReturnValue({
            then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
          }),
        };
      }),
    })),
  };
  return {
    db: {
      transaction: vi.fn(async (fn: (t: unknown) => unknown) => {
        idx = 0;
        return fn(tx);
      }),
    },
  };
});

let mockShopItem: Record<string, unknown> | null = null;

import { purchaseShopItem } from '@/lib/db/shop';
import { AlreadyOwnedError } from '@/lib/errors/shop-errors';
import { HOME_FURNITURE_COPY_CAP } from '@/lib/home/furniture-catalog';

const FURNITURE_ITEM = {
  id: 'si-chair',
  slug: 'chair-wood', // real FURNITURE_CATALOG slug
  kind: 'home',
  priceCoins: 120,
  isActive: true,
};
const WALLPAPER_ITEM = {
  id: 'si-wall',
  slug: 'wall-stars', // real surface slug — NOT in the furniture catalog
  kind: 'home',
  priceCoins: 320,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.existingPurchaseRows = 0;
  state.balance = 10_000;
  state.purchaseInserted = false;
});

describe('E3 multi-buy purchase cap', () => {
  it('furniture: buying a 2nd and 3rd copy succeeds', async () => {
    mockShopItem = FURNITURE_ITEM;
    state.existingPurchaseRows = 1;
    await expect(purchaseShopItem('c1', 'si-chair')).resolves.toMatchObject({
      shopItemId: 'si-chair',
    });
    state.existingPurchaseRows = HOME_FURNITURE_COPY_CAP - 1;
    await expect(purchaseShopItem('c1', 'si-chair')).resolves.toMatchObject({
      shopItemId: 'si-chair',
    });
    expect(state.awardCoinsInTx).toHaveBeenCalledTimes(2);
  });

  it('furniture: the copy cap blocks a 4th purchase', async () => {
    mockShopItem = FURNITURE_ITEM;
    state.existingPurchaseRows = HOME_FURNITURE_COPY_CAP;
    await expect(purchaseShopItem('c1', 'si-chair')).rejects.toThrow(AlreadyOwnedError);
    expect(state.awardCoinsInTx).not.toHaveBeenCalled();
  });

  it('wallpaper (home kind but not furniture) stays own-1', async () => {
    mockShopItem = WALLPAPER_ITEM;
    state.existingPurchaseRows = 1;
    await expect(purchaseShopItem('c1', 'si-wall')).rejects.toThrow(AlreadyOwnedError);
    expect(state.awardCoinsInTx).not.toHaveBeenCalled();
  });
});
