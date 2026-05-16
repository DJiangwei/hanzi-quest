import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@/db';
import { getPackBySlug, listChildCollection } from '@/lib/db/collections';

describe('collections db', () => {
  afterEach(() => vi.clearAllMocks());

  it('listChildCollection returns owned items joined to collectible_items', async () => {
    const rows = [
      { itemId: 'i1', count: 2, firstObtainedAt: new Date(), slug: 'rat', nameZh: '鼠', nameEn: 'Rat', rarity: 'common', dropWeight: 1, loreZh: null, loreEn: null, imageUrl: null, packId: 'p1' },
    ];
    const whereMock = vi.fn().mockResolvedValue(rows);
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock });

    const result = await listChildCollection('child-1', 'pack-id-1');
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it('getPackBySlug returns the pack row or null', async () => {
    const limitMock = vi.fn().mockResolvedValue([{ id: 'p1', slug: 'zodiac-v1', name: '十二生肖' }]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock });

    const pack = await getPackBySlug('zodiac-v1');
    expect(pack?.id).toBe('p1');
  });
});
