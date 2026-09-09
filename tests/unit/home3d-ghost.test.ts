import { describe, it, expect } from 'vitest';
import { ghostTint, ghostTiles } from '@/lib/home3d/ghost';

describe('ghost feedback', () => {
  it('is green when legal and red when not', () => {
    expect(ghostTint(true)).not.toEqual(ghostTint(false));
  });

  it('marks one tile per footprint cell', () => {
    expect(ghostTiles(2, 3, 2, 1)).toHaveLength(2);
    expect(ghostTiles(2, 3, 1, 1)).toEqual([{ x: 2, y: 3 }]);
  });
});
