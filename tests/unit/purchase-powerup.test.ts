import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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

beforeEach(() => {
  for (const m of Object.values(txMock)) m.mockReset();
  dbMock.transaction.mockClear();
});

function chainShopItem(shopItem: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(shopItem ? [shopItem] : []),
      }),
    }),
  };
}

function chainBalance(balance: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ balance }]),
    }),
  };
}

describe('purchaseShopItem — powerup kind', () => {
  it('increments inventory, no AlreadyOwnedError on repeat purchase', async () => {
    const shopItem = {
      id: 's-hint',
      slug: 'pw-hint',
      kind: 'powerup',
      priceCoins: 30,
      isActive: true,
      metadata: { powerupKind: 'hint' },
    };
    txMock.select
      .mockReturnValueOnce(chainShopItem(shopItem))
      .mockReturnValueOnce(chainBalance(500))
      .mockReturnValueOnce(chainBalance(470));

    txMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await purchaseShopItem('c1', 's-hint');
    expect(result.shopItemId).toBe('s-hint');
    expect(result.avatarItemId).toBeNull();
    expect(result.coinsAfter).toBe(470);
  });

  it('rejects when metadata.powerupKind is invalid', async () => {
    const shopItem = {
      id: 's-bad',
      slug: 'pw-bad',
      kind: 'powerup',
      priceCoins: 30,
      isActive: true,
      metadata: { powerupKind: 'NOT_A_KIND' },
    };
    txMock.select.mockReturnValueOnce(chainShopItem(shopItem));
    await expect(purchaseShopItem('c1', 's-bad')).rejects.toThrow(ItemNotPurchasableError);
  });

  it('rejects when metadata.powerupKind is missing', async () => {
    const shopItem = {
      id: 's-bad',
      slug: 'pw-bad',
      kind: 'powerup',
      priceCoins: 30,
      isActive: true,
      metadata: {},
    };
    txMock.select.mockReturnValueOnce(chainShopItem(shopItem));
    await expect(purchaseShopItem('c1', 's-bad')).rejects.toThrow(ItemNotPurchasableError);
  });
});
