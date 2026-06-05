import { describe, expect, it } from 'vitest';
import { voyageLayout } from '@/lib/play/voyage-layout';

describe('voyageLayout (vertical zigzag)', () => {
  it('returns one position per stop, all in 0–100', () => {
    const pts = voyageLayout(10);
    expect(pts).toHaveLength(10);
    for (const p of pts) {
      expect(p.xPct).toBeGreaterThanOrEqual(0);
      expect(p.xPct).toBeLessThanOrEqual(100);
      expect(p.yPct).toBeGreaterThanOrEqual(0);
      expect(p.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('steps straight down: yPct strictly increases with index', () => {
    const pts = voyageLayout(10);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].yPct).toBeGreaterThan(pts[i - 1].yPct);
    }
  });

  it('alternates left / right of centre (zigzag)', () => {
    const pts = voyageLayout(6);
    expect(pts[0].xPct).toBeLessThan(50);
    expect(pts[1].xPct).toBeGreaterThan(50);
    expect(pts[2].xPct).toBeLessThan(50);
    expect(pts[3].xPct).toBeGreaterThan(50);
    expect(pts[0].xPct).toBe(pts[2].xPct);
    expect(pts[1].xPct).toBe(pts[3].xPct);
  });

  it('handles 1 and 9 stops without throwing', () => {
    expect(voyageLayout(1)).toHaveLength(1);
    expect(voyageLayout(9)).toHaveLength(9);
  });

  it('returns empty for 0', () => {
    expect(voyageLayout(0)).toEqual([]);
  });
});
