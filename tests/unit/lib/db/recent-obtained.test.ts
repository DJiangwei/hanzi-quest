import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));

import {
  mergeRecentItems,
  type CollectionSourceRow,
  type AvatarSourceRow,
  type ShopSourceRow,
} from '@/lib/db/recent-obtained';

const childId = 'child_1';

describe('mergeRecentItems', () => {
  it('returns empty array when all sources empty', () => {
    expect(mergeRecentItems([], [], [], childId, 3)).toEqual([]);
  });

  it('sorts by obtainedAt DESC and caps at limit', () => {
    const collection: CollectionSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-10T00:00:00Z'),
        packSlug: 'zodiac',
        imageUrl: '🐉',
        nameZh: '龙',
        nameEn: 'Dragon',
      },
    ];
    const avatar: AvatarSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-12T00:00:00Z'),
        slotId: 'hat',
        name: 'Tricorn',
      },
    ];
    const purchases: ShopSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-11T00:00:00Z'),
        kind: 'pet',
        name: '🦜 鹦鹉 / Parrot',
        imageUrl: '🦜',
      },
    ];

    const result = mergeRecentItems(collection, avatar, purchases, childId, 3);

    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('avatar');
    expect(result[1].kind).toBe('pet');
    expect(result[2].kind).toBe('collection');
  });

  it('caps at the limit when more than limit items present', () => {
    const collection: CollectionSourceRow[] = Array.from({ length: 5 }, (_, i) => ({
      obtainedAt: new Date(Date.UTC(2026, 4, i + 1)),
      packSlug: 'zodiac',
      imageUrl: null,
      nameZh: `项目${i}`,
      nameEn: `Item${i}`,
    }));
    expect(mergeRecentItems(collection, [], [], childId, 3)).toHaveLength(3);
  });

  it('resolves href per kind using childId', () => {
    const collection: CollectionSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-10T00:00:00Z'),
        packSlug: 'flags',
        imageUrl: null,
        nameZh: '中国',
        nameEn: 'China',
      },
    ];
    const avatar: AvatarSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-09T00:00:00Z'),
        slotId: 'hat',
        name: 'Tricorn',
      },
    ];
    const purchases: ShopSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-08T00:00:00Z'),
        kind: 'decor',
        name: '🏝 椰岛 / Palm Island',
        imageUrl: null,
      },
    ];

    const result = mergeRecentItems(collection, avatar, purchases, childId, 10);
    const byKind = Object.fromEntries(result.map((r) => [r.kind, r.href]));
    expect(byKind.collection).toBe(`/play/${childId}/collection/flags`);
    expect(byKind.avatar).toBe(`/play/${childId}/shop?tab=avatar`);
    expect(byKind.decor).toBe(`/play/${childId}/shop?tab=decor`);
  });

  it('falls back to gift emoji when imageUrl null on collection', () => {
    const collection: CollectionSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-10T00:00:00Z'),
        packSlug: 'zodiac',
        imageUrl: null,
        nameZh: '龙',
        nameEn: 'Dragon',
      },
    ];
    const result = mergeRecentItems(collection, [], [], childId, 3);
    expect(result[0].displayEmoji).toBe('🎁');
  });

  it('splits bilingual shop name on " / " separator', () => {
    const purchases: ShopSourceRow[] = [
      {
        obtainedAt: new Date('2026-05-10T00:00:00Z'),
        kind: 'pet',
        name: '🦜 鹦鹉 / Parrot',
        imageUrl: null,
      },
    ];
    const result = mergeRecentItems([], [], purchases, childId, 3);
    expect(result[0].nameZh).toBe('鹦鹉');
    expect(result[0].nameEn).toBe('Parrot');
  });
});
