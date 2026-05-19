import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  purchaseShopItem: vi.fn(),
  equipAvatarItem: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: mocks.requireChild,
}));

vi.mock('@/lib/db/shop', () => ({
  purchaseShopItem: mocks.purchaseShopItem,
  equipAvatarItem: mocks.equipAvatarItem,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  equipAvatarItemAction,
  purchaseShopItemAction,
} from '@/lib/actions/shop';

beforeEach(() => {
  mocks.requireChild.mockReset();
  mocks.purchaseShopItem.mockReset();
  mocks.equipAvatarItem.mockReset();
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
