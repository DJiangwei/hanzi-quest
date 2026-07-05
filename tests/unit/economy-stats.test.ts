import { describe, expect, it, vi } from 'vitest';
vi.mock('@/db', () => ({ db: {} }));
import {
  shapeCardDaily,
  shapeCoinStats,
  shapeShopExhaustion,
  shapeXpStats,
} from '@/lib/db/economy-stats';

const NOW = new Date('2026-07-05T12:00:00Z');
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000);

describe('shapeCoinStats', () => {
  it('splits earned/spent and groups by reason', () => {
    const s = shapeCoinStats(
      [
        { delta: 100, reason: 'scene_complete', createdAt: d(1) },
        { delta: 50, reason: 'scene_complete', createdAt: d(2) },
        { delta: -80, reason: 'shop_purchase', createdAt: d(3) },
        { delta: 20, reason: 'daily_login', createdAt: d(40) }, // outside 30d
      ],
      500,
      NOW,
    );
    expect(s.balance).toBe(500);
    expect(s.lifetime).toMatchObject({ earned: 170, spent: 80 });
    expect(s.last30).toMatchObject({ earned: 150, spent: 80 });
    expect(s.lifetime.byReason[0]).toEqual({ key: 'scene_complete', total: 150 });
    expect(s.lifetime.byReason).toContainEqual({ key: 'shop_purchase', total: -80 });
  });

  it('produces 8 weekly buckets including empty weeks, oldest first', () => {
    const s = shapeCoinStats([{ delta: 30, reason: 'scene_complete', createdAt: d(2) }], 0, NOW);
    expect(s.weeklyNet).toHaveLength(8);
    expect(s.weeklyNet.at(-1)!.net).toBe(30);
    expect(s.weeklyNet[0].net).toBe(0);
    // buckets are Mondays, ascending
    expect(s.weeklyNet[0].weekStartIso < s.weeklyNet.at(-1)!.weekStartIso).toBe(true);
  });

  it('handles a zero-history child', () => {
    const s = shapeCoinStats([], 0, NOW);
    expect(s.lifetime).toMatchObject({ earned: 0, spent: 0, byReason: [] });
    expect(s.weeklyNet.every((w) => w.net === 0)).toBe(true);
  });
});

describe('shapeXpStats', () => {
  it('groups by source with a 30d window', () => {
    const s = shapeXpStats(
      [
        { amount: 10, source: 'scene_complete', createdAt: d(1) },
        { amount: 30, source: 'homework', createdAt: d(35) },
      ],
      NOW,
    );
    expect(s.lifetime).toContainEqual({ key: 'homework', total: 30 });
    expect(s.last30).toEqual([{ key: 'scene_complete', total: 10 }]);
  });
});

describe('shapeCardDaily', () => {
  it('fills 14 days incl zeros, oldest first', () => {
    const out = shapeCardDaily([{ dayUtc: '2026-07-04', count: 3 }], '2026-07-05');
    expect(out).toHaveLength(14);
    expect(out.at(-1)).toEqual({ dayUtc: '2026-07-05', count: 0 });
    expect(out.at(-2)).toEqual({ dayUtc: '2026-07-04', count: 3 });
    expect(out[0].dayUtc).toBe('2026-06-22');
  });
});

describe('shapeShopExhaustion', () => {
  it('computes owned/total/remainingCost per kind + grand total', () => {
    const items = [
      { id: 'a', kind: 'avatar', priceCoins: 100 },
      { id: 'b', kind: 'avatar', priceCoins: 200 },
      { id: 'c', kind: 'pet', priceCoins: 300 },
    ];
    const s = shapeShopExhaustion(items, new Set(['a']), 250);
    expect(s.byKind).toContainEqual({ kind: 'avatar', owned: 1, total: 2, remainingCost: 200 });
    expect(s.byKind).toContainEqual({ kind: 'pet', owned: 0, total: 1, remainingCost: 300 });
    expect(s.totalRemainingCost).toBe(500);
    expect(s.balance).toBe(250);
  });

  it('handles empty catalog', () => {
    const s = shapeShopExhaustion([], new Set(), 0);
    expect(s.byKind).toEqual([]);
    expect(s.totalRemainingCost).toBe(0);
  });
});
