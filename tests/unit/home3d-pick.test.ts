import { describe, it, expect } from 'vitest';
import { pickCell } from '@/lib/home3d/pick';
import { cellToWorld } from '@/lib/home3d/coords';

describe('pickCell', () => {
  it('resolves a hit at a cell centre to that cell', () => {
    const p = cellToWorld(3, 4, 1, 1);
    expect(pickCell({ x: p.x, z: p.z }, 1, 1, 8, 6)).toEqual({ gridX: 3, gridY: 4 });
  });

  it('clamps a drag past the right edge to the last legal anchor', () => {
    // a 2-wide piece can anchor at most at x = cols - w = 6
    expect(pickCell({ x: 99, z: 0 }, 2, 1, 8, 6).gridX).toBe(6);
  });

  it('clamps a drag past the top edge to 0', () => {
    expect(pickCell({ x: -99, z: -99 }, 1, 1, 8, 6)).toEqual({ gridX: 0, gridY: 0 });
  });
});
