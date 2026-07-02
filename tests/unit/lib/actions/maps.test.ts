import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(),
}));
vi.mock('@/lib/db/maps', () => ({
  listMapsForChild: vi.fn(),
  setCurrentPackForChild: vi.fn(),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { requireChild } from '@/lib/auth/guards';
import { listMapsForChild, setCurrentPackForChild } from '@/lib/db/maps';
import { revalidatePath } from 'next/cache';
import { switchMapAction } from '@/lib/actions/maps';
import { MapLockedError } from '@/lib/errors/maps-errors';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireChild).mockResolvedValue({ child: { id: 'child_1' } } as never);
});

describe('switchMapAction', () => {
  it('switches to an unlocked pack and revalidates home', async () => {
    vi.mocked(listMapsForChild).mockResolvedValue([
      { packId: 'pack_1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean Sea', weekCount: 10, clearedCount: 3, isLocked: false, gated: false, isCurrent: true },
      { packId: 'pack_2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian Ocean', weekCount: 0, clearedCount: 0, isLocked: false, gated: false, isCurrent: false },
    ]);
    await switchMapAction('child_1', 'pack_2');
    expect(setCurrentPackForChild).toHaveBeenCalledWith('child_1', 'pack_2');
    expect(revalidatePath).toHaveBeenCalledWith('/play/child_1');
  });

  it('throws MapLockedError for a locked pack', async () => {
    vi.mocked(listMapsForChild).mockResolvedValue([
      { packId: 'pack_1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean Sea', weekCount: 10, clearedCount: 3, isLocked: false, gated: false, isCurrent: true },
      { packId: 'pack_2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian Ocean', weekCount: 0, clearedCount: 0, isLocked: true, gated: false, isCurrent: false },
    ]);
    await expect(switchMapAction('child_1', 'pack_2')).rejects.toBeInstanceOf(MapLockedError);
    expect(setCurrentPackForChild).not.toHaveBeenCalled();
  });

  it('throws when packId is not in the child\'s pack list', async () => {
    vi.mocked(listMapsForChild).mockResolvedValue([
      { packId: 'pack_1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean Sea', weekCount: 10, clearedCount: 3, isLocked: false, gated: false, isCurrent: true },
    ]);
    await expect(switchMapAction('child_1', 'pack_999')).rejects.toThrow();
  });
});
