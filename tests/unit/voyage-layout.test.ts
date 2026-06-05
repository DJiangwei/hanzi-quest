import { describe, expect, it } from 'vitest';
import { voyageLayout } from '@/lib/play/voyage-layout';

describe('voyageLayout', () => {
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

  it('uses at most 5 stops per row (two rows for 10)', () => {
    const pts = voyageLayout(10);
    const rows = new Set(pts.map((p) => p.yPct));
    expect(rows.size).toBe(2);
  });

  it('runs row 0 left→right and row 1 right→left (serpentine)', () => {
    const pts = voyageLayout(10);
    // row 0 = first 5 ascending x; row 1 = next 5 descending x
    expect(pts[0].xPct).toBeLessThan(pts[4].xPct);
    expect(pts[5].xPct).toBeGreaterThan(pts[9].xPct);
    // the transition stop (index 5) sits under the end of row 0 (similar x to index 4)
    expect(Math.abs(pts[5].xPct - pts[4].xPct)).toBeLessThan(15);
  });

  it('centers a single row vertically', () => {
    const pts = voyageLayout(4);
    expect(new Set(pts.map((p) => p.yPct)).size).toBe(1);
    expect(pts[0].yPct).toBeGreaterThan(40);
    expect(pts[0].yPct).toBeLessThan(60);
  });

  it('handles 1 and 9 stops without throwing', () => {
    expect(voyageLayout(1)).toHaveLength(1);
    expect(voyageLayout(9)).toHaveLength(9);
  });
});
