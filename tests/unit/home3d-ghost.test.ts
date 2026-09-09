import { describe, it, expect } from 'vitest';
import { ghostTint, ghostTiles } from '@/lib/home3d/ghost';

describe('ghost feedback', () => {
  it('is the exact legal green and illegal red — not just "different colours"', () => {
    // Asserting only inequality would pass with the colours swapped, i.e.
    // green on a cell she cannot use. Pin the actual hex per state.
    expect(ghostTint(true)).toBe('#4ade80');
    expect(ghostTint(false)).toBe('#f87171');
  });

  it('marks one tile per footprint cell', () => {
    expect(ghostTiles(2, 3, 2, 1)).toHaveLength(2);
    expect(ghostTiles(2, 3, 1, 1)).toEqual([{ x: 2, y: 3 }]);
  });
});
