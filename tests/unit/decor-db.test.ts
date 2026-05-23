import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));

import {
  listDecorShopListings,
  listOwnedDecorationsForChild,
} from '@/lib/db/decor';

function makeChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

beforeEach(() => {
  dbMock.select.mockReset();
});

describe('listDecorShopListings', () => {
  it('returns shop+decor rows joined by slug', async () => {
    const rows = [
      {
        shopItem: { id: 's1', slug: 'sailboat', kind: 'decor', isActive: true, priceCoins: 200, name: '小帆船 / Sailboat' },
        decoration: { id: 'd1', slug: 'sailboat', nameZh: '小帆船', nameEn: 'Sailboat', anchorSlug: 'top-right', emoji: '⛵' },
      },
    ];
    dbMock.select.mockReturnValueOnce(makeChain(rows));
    const result = await listDecorShopListings();
    expect(result).toEqual(rows);
  });
});

describe('listOwnedDecorationsForChild', () => {
  it('returns empty array for child with no purchases', async () => {
    dbMock.select.mockReturnValueOnce(makeChain([]));
    const result = await listOwnedDecorationsForChild('c1');
    expect(result).toEqual([]);
  });

  it('returns decoration rows for owned shop_purchases', async () => {
    // Wrapper because the impl maps r.decoration
    const wrapped = [
      { decoration: { id: 'd1', slug: 'sailboat', nameZh: '小帆船', nameEn: 'Sailboat', anchorSlug: 'top-right' } },
      { decoration: { id: 'd2', slug: 'lighthouse', nameZh: '灯塔', nameEn: 'Lighthouse', anchorSlug: 'between-6-7' } },
    ];
    dbMock.select.mockReturnValueOnce(makeChain(wrapped));
    const result = await listOwnedDecorationsForChild('c1');
    expect(result).toEqual(wrapped.map((r) => r.decoration));
  });
});
