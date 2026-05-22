import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  setSoundTheme: vi.fn(),
  listChildOwnedShopItemIds: vi.fn(),
  listShopItemsByKind: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/settings', () => ({ setSoundTheme: mocks.setSoundTheme }));
vi.mock('@/lib/db/shop', () => ({
  listChildOwnedShopItemIds: mocks.listChildOwnedShopItemIds,
  listShopItemsByKind: mocks.listShopItemsByKind,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { equipSoundThemeAction } from '@/lib/actions/settings';

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
});

describe('equipSoundThemeAction', () => {
  it("accepts 'default' (slug=null) without ownership check", async () => {
    await equipSoundThemeAction('c1', null);
    expect(mocks.setSoundTheme).toHaveBeenCalledWith('c1', null);
    expect(mocks.listChildOwnedShopItemIds).not.toHaveBeenCalled();
  });

  it('rejects an unowned theme slug', async () => {
    mocks.listShopItemsByKind.mockResolvedValue([
      { id: 'item_nautical', slug: 'theme-nautical' },
    ]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue([]);
    await expect(
      equipSoundThemeAction('c1', 'theme-nautical'),
    ).rejects.toThrow(/not owned/i);
    expect(mocks.setSoundTheme).not.toHaveBeenCalled();
  });

  it('accepts an owned theme slug and writes it to settings', async () => {
    mocks.listShopItemsByKind.mockResolvedValue([
      { id: 'item_nautical', slug: 'theme-nautical' },
    ]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue(['item_nautical']);
    await equipSoundThemeAction('c1', 'theme-nautical');
    expect(mocks.setSoundTheme).toHaveBeenCalledWith('c1', 'theme-nautical');
  });

  it('rejects an unknown slug (not in catalog)', async () => {
    mocks.listShopItemsByKind.mockResolvedValue([]);
    await expect(
      equipSoundThemeAction('c1', 'theme-doesnt-exist'),
    ).rejects.toThrow(/unknown theme/i);
  });
});
