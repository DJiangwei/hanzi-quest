import { describe, it, expect } from 'vitest';
import { pickCell } from '@/lib/home3d/pick';
import { cellToWorld, WALL_ROWS } from '@/lib/home3d/coords';

describe('pickCell', () => {
  it('resolves a hit at a cell centre to that cell', () => {
    const p = cellToWorld(3, 4, 1, 1);
    expect(pickCell({ x: p.x, z: p.z }, 1, 1, 8, 6)).toEqual({ gridX: 3, gridY: 4 });
  });

  it('clamps a drag past the right edge to the last legal anchor', () => {
    // a 2-wide piece can anchor at most at x = cols - w = 6
    expect(pickCell({ x: 99, z: 0 }, 2, 1, 8, 6).gridX).toBe(6);
  });

  it('clamps a drag past the top edge to WALL_ROWS', () => {
    expect(pickCell({ x: -99, z: -99 }, 1, 1, 8, 6)).toEqual({ gridX: 0, gridY: WALL_ROWS });
  });

  it('never resolves into the wall zone — the floor starts at WALL_ROWS', () => {
    // worldToCell's gridY already includes WALL_ROWS, so a lower bound of 0
    // would let a tall piece anchor in the wall. yard-swing (2x2) and
    // yard-tree (1x2) are real floor items that hit this.
    expect(pickCell({ x: 0, z: -99 }, 2, 2, 8, 6).gridY).toBe(WALL_ROWS);
  });

  it('clamps a 2-tall piece to the last legal anchor at the back of the room', () => {
    expect(pickCell({ x: 0, z: 99 }, 2, 2, 8, 6).gridY).toBe(6 - 2);
  });
});
