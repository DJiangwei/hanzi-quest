/**
 * 连连看 (Lianliankan) pure helpers — board state + path-finding.
 *
 * Locked rules per PR #57 spec:
 *  - Path: orthogonal segments only, ≤2 right-angle bends
 *  - Intermediate cells must be EMPTY; endpoints can be tiles
 *  - No diagonals, no wrap-around
 */

export type TileDisplay =
  | { kind: 'hanzi'; text: string }
  | { kind: 'meaning'; text: string };

export type CellContent =
  | { kind: 'empty' }
  | { kind: 'tile'; tileId: string; pairId: string; display: TileDisplay };

export interface LianliankanBoard {
  rows: number;
  cols: number;
  cells: CellContent[][]; // rows × cols
}

export interface Cell {
  row: number;
  col: number;
}

type Dir = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left
const DR: Record<Dir, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };
const DC: Record<Dir, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };

interface SearchState {
  row: number;
  col: number;
  dir: Dir;
  bends: number;
  path: Cell[];
}

function isInBounds(board: LianliankanBoard, r: number, c: number): boolean {
  return r >= 0 && r < board.rows && c >= 0 && c < board.cols;
}

function isEmpty(board: LianliankanBoard, r: number, c: number): boolean {
  return board.cells[r]![c]!.kind === 'empty';
}

function visitedKey(r: number, c: number, dir: Dir, bends: number): string {
  return `${r},${c},${dir},${bends}`;
}

export function findPath(
  board: LianliankanBoard,
  from: Cell,
  to: Cell,
): Cell[] | null {
  if (from.row === to.row && from.col === to.col) return null;

  const visited = new Set<string>();
  const queue: SearchState[] = [];

  for (let dir = 0 as Dir; dir < 4; dir = (dir + 1) as Dir) {
    const nr = from.row + DR[dir];
    const nc = from.col + DC[dir];
    if (!isInBounds(board, nr, nc)) continue;
    if (nr === to.row && nc === to.col) {
      return [from, to];
    }
    if (!isEmpty(board, nr, nc)) continue;
    const key = visitedKey(nr, nc, dir, 0);
    if (visited.has(key)) continue;
    visited.add(key);
    queue.push({ row: nr, col: nc, dir, bends: 0, path: [from, { row: nr, col: nc }] });
  }

  while (queue.length > 0) {
    const state = queue.shift()!;
    for (let dir = 0 as Dir; dir < 4; dir = (dir + 1) as Dir) {
      const isBend = dir !== state.dir;
      const newBends = isBend ? state.bends + 1 : state.bends;
      if (newBends > 2) continue;
      const nr = state.row + DR[dir];
      const nc = state.col + DC[dir];
      if (!isInBounds(board, nr, nc)) continue;
      if (nr === to.row && nc === to.col) {
        return [...state.path, { row: nr, col: nc }];
      }
      if (!isEmpty(board, nr, nc)) continue;
      const key = visitedKey(nr, nc, dir, newBends);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({
        row: nr,
        col: nc,
        dir,
        bends: newBends,
        path: [...state.path, { row: nr, col: nc }],
      });
    }
  }
  return null;
}
