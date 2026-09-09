import { describe, it, expect } from 'vitest';
import { cellToWorld, worldToCell, COLS, ROWS, WALL_ROWS } from '@/lib/home3d/coords';

/**
 * An off-by-one here puts the ghost one cell from where the piece lands — the
 * single most confusing bug this feature could ship, and one that looks like
 * "the game is laggy" rather than like a bug.
 */
describe('worldToCell is the exact inverse of cellToWorld', () => {
  it('round-trips every floor cell for a 1x1 footprint', () => {
    for (let gx = 0; gx < COLS; gx++) {
      for (let gy = WALL_ROWS; gy < ROWS; gy++) {
        const { x, z } = cellToWorld(gx, gy, 1, 1);
        expect(worldToCell(x, z, 1, 1)).toEqual({ gridX: gx, gridY: gy });
      }
    }
  });

  it('round-trips a 2x1 footprint', () => {
    const { x, z } = cellToWorld(3, 4, 2, 1);
    expect(worldToCell(x, z, 2, 1)).toEqual({ gridX: 3, gridY: 4 });
  });

  it('snaps a point inside a cell to that cell, not the next one', () => {
    const { x, z } = cellToWorld(3, 4, 1, 1);
    expect(worldToCell(x + 0.3, z + 0.3, 1, 1)).toEqual({ gridX: 3, gridY: 4 });
    expect(worldToCell(x - 0.3, z - 0.3, 1, 1)).toEqual({ gridX: 3, gridY: 4 });
  });
});
