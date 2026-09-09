import { describe, it, expect } from 'vitest';
import { canPlaceAt } from '@/lib/home/placement-rules';

// 'rug-round' is a floor item; the top 2 rows of every room are the wall zone.
const NONE: { slug: string; copyIndex: number; gridX: number; gridY: number }[] = [];

describe('canPlaceAt', () => {
  it('accepts a floor item in the floor zone', () => {
    expect(canPlaceAt('bedroom', 'rug-round', 2, 3, NONE)).toEqual({ ok: true });
  });

  it('rejects a floor item placed in the wall zone', () => {
    const v = canPlaceAt('bedroom', 'rug-round', 2, 0, NONE);
    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ reason: 'wrong-surface' });
  });

  it('rejects a footprint that runs off the right edge', () => {
    // Verified against the catalog: bed-cozy is 2x1 and the grid is 8 wide, so
    // x=7 gives 7+2=9 > 8. Do not swap in a 1x1 item here — it would fit, and
    // the test would pass against a broken bounds check.
    const v = canPlaceAt('bedroom', 'bed-cozy', 7, 3, NONE);
    expect(v).toMatchObject({ ok: false, reason: 'out-of-bounds' });
  });

  it('accepts the LAST floor row — 5+1 is not greater than rows=6', () => {
    // The obvious off-by-one in either direction is visible here.
    expect(canPlaceAt('bedroom', 'bed-cozy', 2, 5, NONE)).toEqual({ ok: true });
  });

  it('rejects a cell already occupied by another piece', () => {
    const placed = [{ slug: 'rug-round', copyIndex: 0, gridX: 2, gridY: 3 }];
    const v = canPlaceAt('bedroom', 'rug-round', 2, 3, placed);
    expect(v).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('ignores the copy being moved, but not a DIFFERENT copy of the same slug', () => {
    const placed = [
      { slug: 'rug-round', copyIndex: 0, gridX: 2, gridY: 3 },
      { slug: 'rug-round', copyIndex: 1, gridX: 4, gridY: 3 },
    ];
    // moving copy 0 onto its own cell is fine
    expect(canPlaceAt('bedroom', 'rug-round', 2, 3, placed, 0)).toEqual({ ok: true });
    // but copy 0 may not land on copy 1
    expect(canPlaceAt('bedroom', 'rug-round', 4, 3, placed, 0)).toMatchObject({
      ok: false,
      reason: 'occupied',
    });
  });

  it('rejects unknown room and unknown slug rather than throwing', () => {
    expect(canPlaceAt('nowhere', 'rug-round', 2, 3, NONE)).toMatchObject({ reason: 'unknown-room' });
    expect(canPlaceAt('bedroom', 'not-a-thing', 2, 3, NONE)).toMatchObject({ reason: 'unknown-slug' });
  });
});
