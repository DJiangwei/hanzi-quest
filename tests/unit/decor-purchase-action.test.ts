import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/coins', () => ({
  awardCoinsInTx: vi.fn().mockResolvedValue(undefined),
}));

import { purchaseShopItem } from '@/lib/db/shop';
import { ItemNotPurchasableError } from '@/lib/errors/shop-errors';

interface ChainOpts {
  shopItem?: unknown;
  balance?: number;
  existingPurchase?: boolean;
}

function setupGenericChain({ shopItem, balance = 1000, existingPurchase = false }: ChainOpts) {
  // 1) shopItem fetch
  const shopItemChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(shopItem ? [shopItem] : []),
      }),
    }),
  };
  // 2) existing purchase check (only for generic kinds)
  const existingPurchaseChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(existingPurchase ? [{ id: 'p1' }] : []),
      }),
    }),
  };
  // 3) balance fetch (debitAndRecord)
  const balanceChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ balance }]),
    }),
  };
  // 4) post-debit balance fetch
  const postBalanceChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ balance: balance - (shopItem as { priceCoins: number }).priceCoins }]),
    }),
  };
  txMock.select
    .mockReturnValueOnce(shopItemChain)
    .mockReturnValueOnce(existingPurchaseChain)
    .mockReturnValueOnce(balanceChain)
    .mockReturnValueOnce(postBalanceChain);

  txMock.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  txMock.select.mockReset();
  txMock.insert.mockReset();
});

describe('purchaseShopItem dispatch', () => {
  it('decor purchase succeeds (no avatar side-effect)', async () => {
    setupGenericChain({
      shopItem: { id: 's1', slug: 'sailboat', kind: 'decor', priceCoins: 200, isActive: true },
    });
    const result = await purchaseShopItem('c1', 's1');
    expect(result.shopItemId).toBe('s1');
    expect(result.avatarItemId).toBeNull();
  });

  it('pet purchase succeeds (regression: was broken by avatar-only guard)', async () => {
    setupGenericChain({
      shopItem: { id: 's2', slug: 'pet-parrot', kind: 'pet', priceCoins: 300, isActive: true },
    });
    const result = await purchaseShopItem('c1', 's2');
    expect(result.shopItemId).toBe('s2');
    expect(result.avatarItemId).toBeNull();
  });

  it('sound_theme purchase succeeds (regression: was broken)', async () => {
    setupGenericChain({
      shopItem: { id: 's3', slug: 'music-box', kind: 'sound_theme', priceCoins: 250, isActive: true },
    });
    const result = await purchaseShopItem('c1', 's3');
    expect(result.shopItemId).toBe('s3');
  });

  it('consumable throws ItemNotPurchasableError', async () => {
    // only shopItem fetch is hit before throw
    const shopItemChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 's4', slug: 'whatever', kind: 'consumable', priceCoins: 100, isActive: true }]),
        }),
      }),
    };
    txMock.select.mockReturnValueOnce(shopItemChain);
    await expect(purchaseShopItem('c1', 's4')).rejects.toThrow(ItemNotPurchasableError);
  });
});
