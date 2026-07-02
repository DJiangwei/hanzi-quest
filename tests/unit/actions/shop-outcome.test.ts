import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  purchaseShopItem: vi.fn(),
  checkAndGrantTrophies: vi.fn(),
  dbSelect: vi.fn(),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: mocks.requireChild,
}));

vi.mock('@/lib/db/shop', () => ({
  purchaseShopItem: mocks.purchaseShopItem,
  equipAvatarItem: vi.fn(),
}));

vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));

vi.mock('@/db', () => ({
  db: { select: mocks.dbSelect },
}));

vi.mock('@/db/schema', () => ({
  shopItems: {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db/quests', () => ({
  tickQuestProgressSafe: mocks.tickQuestProgressSafe,
}));

import { purchaseShopItemAction } from '@/lib/actions/shop';
import {
  AlreadyOwnedError,
  InsufficientCoinsError,
} from '@/lib/errors/shop-errors';

beforeEach(() => {
  mocks.requireChild.mockReset();
  mocks.purchaseShopItem.mockReset();
  mocks.checkAndGrantTrophies.mockReset();
  mocks.dbSelect.mockReset();
  mocks.tickQuestProgressSafe.mockReset();
  mocks.tickQuestProgressSafe.mockResolvedValue(undefined);
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
  // Default: item kind is 'avatar', priceCoins=300 (no decor trophy check)
  mocks.dbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ kind: 'avatar', priceCoins: 300 }]),
      }),
    }),
  });
});

describe('purchaseShopItemAction — discriminated outcome', () => {
  it('returns {status:"purchased", trophies} on success', async () => {
    mocks.purchaseShopItem.mockResolvedValue({
      shopItemId: 's1',
      coinsAfter: 100,
      avatarItemId: 'a1',
    });

    const res = await purchaseShopItemAction('s1', { childId: 'c1' });

    expect(res).toEqual({ status: 'purchased', trophies: [] });
    expect(mocks.requireChild).toHaveBeenCalledWith('c1');
    expect(mocks.purchaseShopItem).toHaveBeenCalledWith('c1', 's1');
  });

  it('surfaces decor trophies in the purchased outcome', async () => {
    mocks.purchaseShopItem.mockResolvedValue({
      shopItemId: 's1',
      coinsAfter: 100,
      avatarItemId: null,
    });
    mocks.dbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ kind: 'decor', priceCoins: 200 }]),
        }),
      }),
    });
    const trophies = [{ slug: 'decor-starter', nameZh: '装饰家', nameEn: 'Decorator', emoji: '🖼️' }];
    mocks.checkAndGrantTrophies.mockResolvedValue(trophies);

    const res = await purchaseShopItemAction('s1', { childId: 'c1' });

    expect(res).toEqual({ status: 'purchased', trophies });
  });

  it('returns {status:"already_owned"} when purchaseShopItem throws AlreadyOwnedError', async () => {
    mocks.purchaseShopItem.mockRejectedValue(new AlreadyOwnedError('s1'));

    const res = await purchaseShopItemAction('s1', { childId: 'c1' });

    expect(res).toEqual({ status: 'already_owned' });
  });

  it('returns {status:"insufficient", required, available} on InsufficientCoinsError', async () => {
    mocks.purchaseShopItem.mockRejectedValue(new InsufficientCoinsError(50, 10));

    const res = await purchaseShopItemAction('s1', { childId: 'c1' });

    expect(res).toEqual({ status: 'insufficient', required: 50, available: 10 });
  });

  it('re-throws unexpected errors', async () => {
    mocks.purchaseShopItem.mockRejectedValue(new Error('db exploded'));

    await expect(
      purchaseShopItemAction('s1', { childId: 'c1' }),
    ).rejects.toThrow('db exploded');
  });

  it('propagates requireChild rejection (ownership)', async () => {
    mocks.requireChild.mockRejectedValue(new Error('Forbidden'));

    await expect(
      purchaseShopItemAction('s1', { childId: 'evil' }),
    ).rejects.toThrow('Forbidden');
    expect(mocks.purchaseShopItem).not.toHaveBeenCalled();
  });
});
