import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));

import { computeMapGating, type RawMap } from '@/lib/db/maps';

const maps: RawMap[] = [
  {
    packId: 'p1',
    slug: 'pirate-class-level-1',
    nameZh: '加勒比海',
    nameEn: 'Caribbean',
    name: 'c',
    weekCount: 10,
  },
  {
    packId: 'p2',
    slug: 'pirate-class-level-2',
    nameZh: '印度洋',
    nameEn: 'Indian',
    name: 'i',
    weekCount: 9,
  },
];

describe('computeMapGating', () => {
  it('map 1 is never gated; map 2 is gated until map 1 overlord beaten', () => {
    const out = computeMapGating(maps, new Set(), 'p1');
    expect(out.find((m) => m.packId === 'p1')!.gated).toBe(false);
    expect(out.find((m) => m.packId === 'p2')!.gated).toBe(true);
    expect(out.find((m) => m.packId === 'p2')!.isLocked).toBe(true);
  });
  it('beating map 1 ungates map 2', () => {
    const out = computeMapGating(maps, new Set(['p1']), 'p1');
    expect(out.find((m) => m.packId === 'p2')!.gated).toBe(false);
    expect(out.find((m) => m.packId === 'p2')!.isLocked).toBe(false);
  });
  it('a 0-week map stays locked even if ungated', () => {
    const zero: RawMap[] = [{ ...maps[0] }, { ...maps[1], weekCount: 0 }];
    const out = computeMapGating(zero, new Set(['p1']), 'p1');
    expect(out.find((m) => m.packId === 'p2')!.isLocked).toBe(true);
  });
});
