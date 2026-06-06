import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  purchaseShopItem: vi.fn(),
  equipAvatarItem: vi.fn(),
  checkAndGrantTrophies: vi.fn(),
  dbSelect: vi.fn(),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: mocks.requireChild,
}));

vi.mock('@/lib/db/shop', () => ({
  purchaseShopItem: mocks.purchaseShopItem,
  equipAvatarItem: mocks.equipAvatarItem,
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

import {
  equipAvatarItemAction,
  purchaseShopItemAction,
} from '@/lib/actions/shop';

beforeEach(() => {
  mocks.requireChild.mockReset();
  mocks.purchaseShopItem.mockReset();
  mocks.equipAvatarItem.mockReset();
  mocks.checkAndGrantTrophies.mockReset();
  mocks.dbSelect.mockReset();
  mocks.tickQuestProgressSafe.mockReset();
  mocks.tickQuestProgressSafe.mockResolvedValue(undefined);
  // Default: item kind is 'avatar', priceCoins=300 (no trophy check)
  mocks.dbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ kind: 'avatar', priceCoins: 300 }]),
      }),
    }),
  });
});

describe('purchaseShopItemAction', () => {
  it('requires the child and delegates to purchaseShopItem', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.purchaseShopItem.mockResolvedValue({
      shopItemId: 's1',
      coinsAfter: 100,
      avatarItemId: 'a1',
    });

    const result = await purchaseShopItemAction('s1', { childId: 'c1' });

    expect(mocks.requireChild).toHaveBeenCalledWith('c1');
    expect(mocks.purchaseShopItem).toHaveBeenCalledWith('c1', 's1');
    expect(result.coinsAfter).toBe(100);
  });

  it('propagates errors from purchaseShopItem', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.purchaseShopItem.mockRejectedValue(new Error('已经买过啦'));
    await expect(
      purchaseShopItemAction('s1', { childId: 'c1' }),
    ).rejects.toThrow('已经买过啦');
  });

  it('throws when requireChild rejects (parent does not own child)', async () => {
    mocks.requireChild.mockRejectedValue(new Error('Forbidden'));
    await expect(
      purchaseShopItemAction('s1', { childId: 'evil' }),
    ).rejects.toThrow('Forbidden');
    expect(mocks.purchaseShopItem).not.toHaveBeenCalled();
  });
});

describe('purchaseShopItemAction spend_coins quest tick (Task 9)', () => {
  it('fires tickQuestProgressSafe for spend_coins by the item price', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.purchaseShopItem.mockResolvedValue({
      shopItemId: 's1',
      coinsAfter: 700,
      avatarItemId: 'a1',
    });
    // item has priceCoins=300
    mocks.dbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ kind: 'avatar', priceCoins: 300 }]),
        }),
      }),
    });

    await purchaseShopItemAction('s1', { childId: 'c1' });

    // Allow void microtasks to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'spend_coins',
      300,
    );
  });

  it('does NOT fire tickQuestProgressSafe when priceCoins is 0', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.purchaseShopItem.mockResolvedValue({
      shopItemId: 's1',
      coinsAfter: 1000,
      avatarItemId: null,
    });
    mocks.dbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ kind: 'powerup', priceCoins: 0 }]),
        }),
      }),
    });

    await purchaseShopItemAction('s1', { childId: 'c1' });
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).not.toHaveBeenCalled();
  });
});

describe('equipAvatarItemAction', () => {
  it('delegates to equipAvatarItem with the child id', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.equipAvatarItem.mockResolvedValue(undefined);
    await equipAvatarItemAction('avatar-1', { childId: 'c1' });
    expect(mocks.equipAvatarItem).toHaveBeenCalledWith('c1', 'avatar-1');
  });

  it('propagates NotOwnedError', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.equipAvatarItem.mockRejectedValue(new Error('not owned'));
    await expect(
      equipAvatarItemAction('avatar-1', { childId: 'c1' }),
    ).rejects.toThrow('not owned');
  });
});
