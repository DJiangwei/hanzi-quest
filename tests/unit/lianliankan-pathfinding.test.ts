import { describe, expect, it } from 'vitest';
import {
  findPath,
  type LianliankanBoard,
  type CellContent,
} from '@/lib/scenes/lianliankan';

function makeBoard(
  layout: (string | null)[][],
  pairOf: (id: string) => string,
): LianliankanBoard {
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  const cells: CellContent[][] = layout.map((row, r) =>
    row.map((cell, c): CellContent =>
      cell === null
        ? { kind: 'empty' }
        : {
            kind: 'tile',
            tileId: cell,
            pairId: pairOf(cell),
            display: { kind: 'hanzi', text: cell },
          },
    ),
  );
  return { rows, cols, cells };
}

describe('findPath', () => {
  const E = null;

  it('returns 2-cell path when from and to are adjacent on the same row', () => {
    const board = makeBoard(
      [
        [E, E, E, E, E, E],
        [E, 'A', 'B', E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
      ],
      (_) => 'p1',
    );
    const path = findPath(board, { row: 1, col: 1 }, { row: 1, col: 2 });
    expect(path).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]);
  });

  it('returns straight horizontal path through empty cells (0 bends)', () => {
    const board = makeBoard(
      [
        [E, E, E, E, E, E],
        [E, 'A', E, E, 'B', E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
      ],
      (_) => 'p1',
    );
    const path = findPath(board, { row: 1, col: 1 }, { row: 1, col: 4 });
    expect(path).not.toBeNull();
    expect(path?.length).toBe(4);
  });

  it('returns straight vertical path through empty cells (0 bends)', () => {
    const board = makeBoard(
      [
        [E, 'A', E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, 'B', E, E, E, E],
      ],
      (_) => 'p1',
    );
    const path = findPath(board, { row: 0, col: 1 }, { row: 3, col: 1 });
    expect(path).not.toBeNull();
    expect(path?.length).toBe(4);
  });

  it('returns L-shape path (1 bend)', () => {
    const board = makeBoard(
      [
        [E, 'A', E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, 'B', E, E],
      ],
      (_) => 'p1',
    );
    const path = findPath(board, { row: 0, col: 1 }, { row: 3, col: 3 });
    expect(path).not.toBeNull();
  });

  it('returns Z-shape path (2 bends) when direct routes are blocked', () => {
    const board = makeBoard(
      [
        [E, E, E, E, E, E],
        [E, 'A', 'X', 'Y', 'B', E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
      ],
      (id) => (id === 'A' || id === 'B' ? 'p1' : 'p2'),
    );
    const path = findPath(board, { row: 1, col: 1 }, { row: 1, col: 4 });
    expect(path).not.toBeNull();
  });

  it('returns null when path requires > 2 bends', () => {
    const board = makeBoard(
      [
        ['A', 'X', E, E, 'X', E],
        ['X', E, E, 'X', E, E],
        [E, E, 'X', E, E, E],
        ['B', 'X', E, E, 'X', E],
      ],
      (id) => (id === 'A' || id === 'B' ? 'p1' : 'p2'),
    );
    const path = findPath(board, { row: 0, col: 0 }, { row: 3, col: 0 });
    expect(path).toBeNull();
  });

  it('returns null when both endpoints are walled off completely', () => {
    const board = makeBoard(
      [
        ['A', 'X', E, E, E, E],
        ['X', 'X', E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, 'B'],
      ],
      (id) => (id === 'A' || id === 'B' ? 'p1' : 'p2'),
    );
    const path = findPath(board, { row: 0, col: 0 }, { row: 3, col: 5 });
    expect(path).toBeNull();
  });

  it('treats endpoints as tiles (not empty) — intermediate cells must be empty', () => {
    const board = makeBoard(
      [
        [E, 'A', E, 'B', E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
      ],
      (_) => 'p1',
    );
    const path = findPath(board, { row: 0, col: 1 }, { row: 0, col: 3 });
    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ row: 0, col: 1 });
    expect(path?.[path.length - 1]).toEqual({ row: 0, col: 3 });
  });

  it('returns null when intermediate cell has any tile (even of same pair)', () => {
    // Direct horizontal path blocked by A2. Detours also blocked:
    // row above and below are walled off with tiles so no 2-bend route exists.
    const board = makeBoard(
      [
        [E, 'X', 'X', 'X', E, E],
        [E, 'A1', 'A2', 'A3', E, E],
        [E, 'X', 'X', 'X', E, E],
        [E, E, E, E, E, E],
      ],
      (id) => (id === 'A1' || id === 'A2' || id === 'A3' ? 'p1' : 'p2'),
    );
    const path = findPath(board, { row: 1, col: 1 }, { row: 1, col: 3 });
    expect(path).toBeNull();
  });
});
