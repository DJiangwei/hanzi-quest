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

function listRemainingTiles(board: LianliankanBoard): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r]![c]!.kind === 'tile') {
        out.push({ row: r, col: c });
      }
    }
  }
  return out;
}

export function findOneValidPair(
  board: LianliankanBoard,
): { fromTileId: string; toTileId: string } | null {
  const tiles = listRemainingTiles(board);
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i]!;
      const b = tiles[j]!;
      const ca = board.cells[a.row]![a.col]!;
      const cb = board.cells[b.row]![b.col]!;
      if (ca.kind !== 'tile' || cb.kind !== 'tile') continue;
      if (ca.pairId !== cb.pairId) continue;
      const path = findPath(board, a, b);
      if (path !== null) {
        return { fromTileId: ca.tileId, toTileId: cb.tileId };
      }
    }
  }
  return null;
}

export function hasValidPair(board: LianliankanBoard): boolean {
  return findOneValidPair(board) !== null;
}

/**
 * Returns true only when EVERY matching pair on the board has a valid path.
 * Used by buildInitialBoard to guarantee the player is never stuck at the start.
 */
function allPairsReachable(board: LianliankanBoard): boolean {
  const tiles = listRemainingTiles(board);
  // Group tile positions by pairId
  const byPair = new Map<string, Cell[]>();
  for (const pos of tiles) {
    const cell = board.cells[pos.row]![pos.col]!;
    if (cell.kind !== 'tile') continue;
    const group = byPair.get(cell.pairId) ?? [];
    group.push(pos);
    byPair.set(cell.pairId, group);
  }
  for (const [, positions] of byPair) {
    if (positions.length !== 2) continue;
    const [a, b] = positions as [Cell, Cell];
    if (findPath(board, a, b) === null) return false;
  }
  return true;
}

function cloneBoard(board: LianliankanBoard): LianliankanBoard {
  return {
    rows: board.rows,
    cols: board.cols,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
}

export function shuffleRemaining(
  board: LianliankanBoard,
  rng: () => number,
): LianliankanBoard {
  const positions = listRemainingTiles(board);
  if (positions.length === 0) return board;

  const tiles: CellContent[] = positions.map(
    (p) => ({ ...board.cells[p.row]![p.col]! }),
  );

  for (let attempt = 0; attempt < 32; attempt++) {
    const shuffled = tiles.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = tmp;
    }
    const next = cloneBoard(board);
    positions.forEach((p, idx) => {
      next.cells[p.row]![p.col] = shuffled[idx]!;
    });
    if (hasValidPair(next)) return next;
  }
  const fallback = cloneBoard(board);
  positions.forEach((p, idx) => {
    fallback.cells[p.row]![p.col] = tiles[idx]!;
  });
  return fallback;
}

export interface InitialBoardChar {
  id: string;
  hanzi: string;
  meaningEn: string;
}

export function buildInitialBoard(
  chars: InitialBoardChar[],
  rng: () => number,
): LianliankanBoard {
  if (chars.length !== 4) {
    throw new Error(`buildInitialBoard expects exactly 4 chars, got ${chars.length}`);
  }
  const cells: CellContent[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 6 }, (): CellContent => ({ kind: 'empty' })),
  );

  const tiles: CellContent[] = [];
  for (const c of chars) {
    tiles.push({
      kind: 'tile',
      tileId: `${c.id}:hanzi`,
      pairId: c.id,
      display: { kind: 'hanzi', text: c.hanzi },
    });
    tiles.push({
      kind: 'tile',
      tileId: `${c.id}:meaning`,
      pairId: c.id,
      display: { kind: 'meaning', text: c.meaningEn },
    });
  }

  const innerPositions: Cell[] = [];
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= 4; c++) innerPositions.push({ row: r, col: c });
  }

  for (let attempt = 0; attempt < 32; attempt++) {
    const arr = tiles.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    const board: LianliankanBoard = {
      rows: 4,
      cols: 6,
      cells: cells.map((row) => row.map((c) => ({ ...c }))),
    };
    innerPositions.forEach((p, idx) => {
      board.cells[p.row]![p.col] = arr[idx]!;
    });
    if (allPairsReachable(board)) return board;
  }

  const arr = tiles.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  const board: LianliankanBoard = {
    rows: 4,
    cols: 6,
    cells: cells.map((row) => row.map((c) => ({ ...c }))),
  };
  innerPositions.forEach((p, idx) => {
    board.cells[p.row]![p.col] = arr[idx]!;
  });
  return board;
}

export function clearTiles(
  board: LianliankanBoard,
  a: Cell,
  b: Cell,
): LianliankanBoard {
  const next = cloneBoard(board);
  next.cells[a.row]![a.col] = { kind: 'empty' };
  next.cells[b.row]![b.col] = { kind: 'empty' };
  return next;
}

export function isAllCleared(board: LianliankanBoard): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r]![c]!.kind === 'tile') return false;
    }
  }
  return true;
}
