import { describe, expect, it } from 'vitest';
import { voyageLayoutHorizontal } from '@/lib/play/voyage-layout';

describe('voyageLayoutHorizontal (landscape snake)', () => {
  it('returns one position per stop, all in 0–100', () => {
    const pts = voyageLayoutHorizontal(10);
    expect(pts).toHaveLength(10);
    for (const p of pts) {
      expect(p.xPct).toBeGreaterThanOrEqual(0);
      expect(p.xPct).toBeLessThanOrEqual(100);
      expect(p.yPct).toBeGreaterThanOrEqual(0);
      expect(p.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('uses two rows for >5 stops (top row higher than bottom row)', () => {
    const pts = voyageLayoutHorizontal(10);
    // First 5 are the top row, last 5 the bottom row.
    const topY = pts[0].yPct;
    const bottomY = pts[9].yPct;
    expect(topY).toBeLessThan(bottomY);
    expect(pts.slice(0, 5).every((p) => p.yPct === topY)).toBe(true);
    expect(pts.slice(5).every((p) => p.yPct === bottomY)).toBe(true);
  });

  it('snakes: x increases across the top row, decreases across the bottom row', () => {
    const pts = voyageLayoutHorizontal(10);
    for (let i = 1; i < 5; i++) {
      expect(pts[i].xPct).toBeGreaterThan(pts[i - 1].xPct);
    }
    for (let i = 6; i < 10; i++) {
      expect(pts[i].xPct).toBeLessThan(pts[i - 1].xPct);
    }
    // The turn (top-right → bottom-right) keeps x roughly aligned.
    expect(Math.abs(pts[4].xPct - pts[5].xPct)).toBeLessThan(1);
  });

  it('uses a single centred row for ≤5 stops', () => {
    const pts = voyageLayoutHorizontal(4);
    const y = pts[0].yPct;
    expect(pts.every((p) => p.yPct === y)).toBe(true);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].xPct).toBeGreaterThan(pts[i - 1].xPct);
    }
  });

  it('handles odd counts (9) and edge counts (1) without throwing', () => {
    expect(voyageLayoutHorizontal(9)).toHaveLength(9);
    expect(voyageLayoutHorizontal(1)).toHaveLength(1);
  });

  it('returns empty for 0', () => {
    expect(voyageLayoutHorizontal(0)).toEqual([]);
  });
});
