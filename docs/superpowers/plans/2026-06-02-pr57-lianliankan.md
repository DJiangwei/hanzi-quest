# PR #57 — Lianliankan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing `word_match` sight scene with a 连连看 (Lianliankan) puzzle that pairs hanzi tiles with their English meanings via a ≤2-bend tap-tap-clear mechanic.

**Architecture:** New pure path-finding library (`src/lib/scenes/lianliankan.ts`) tested independently of UI. New `LianliankanScene.tsx` component consumes the library. New `'lianliankan'` scene_type enum value + template row (migration 0019). `compile-week.ts` SIGHT slot 1 swaps `word_match` → `lianliankan`. `word_match` template flipped to `is_active=false` post-merge (same pattern as `pinyin_pick`/`visual_pick` retirements). Recompile required.

**Tech Stack:** Next.js 16, React 19, Drizzle (append-only migration 0019), Vitest + RTL + jsdom, Tailwind v4.

---

## Pre-flight

**Branch:** `feat/pr57-lianliankan` (already created off `main`).
**Baseline test count:** 659 (post-PR-#56 main).

```bash
git status  # expect spec doc already committed
rm -rf .next && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green at 659 tests.

---

## File structure

### New files
| Path | Responsibility |
|---|---|
| `src/lib/scenes/lianliankan.ts` | Pure path-finding + board helpers. NEVER imports React or DOM. |
| `src/components/scenes/LianliankanScene.tsx` | `'use client'` visual + interaction component. |
| `src/components/scenes/fx/LianliankanLine.tsx` | Small SVG overlay drawing the connecting line on successful match. |
| `drizzle/0019_<name>.sql` | Drizzle-generated migration: adds `'lianliankan'` to `scene_type` enum. |
| `scripts/retire-word-match.ts` | Idempotent ops script: flips `word_match` template `is_active=false`. |
| `tests/unit/lianliankan-pathfinding.test.ts` | Pure path-finding tests (many edge cases). |
| `tests/unit/lianliankan-board.test.ts` | Board helpers tests (`hasValidPair`, `shuffleRemaining`, `buildInitialBoard`). |
| `tests/unit/lianliankan-scene.test.tsx` | Component interaction tests. |
| `tests/unit/retire-word-match.test.ts` | Ops script unit test. |

### Modified files
| Path | Change |
|---|---|
| `src/db/schema/game.ts` | Extend `scene_type` enum with `'lianliankan'`. |
| `src/lib/scenes/configs.ts` | Add `LianliankanConfigSchema` + `LianliankanConfig` type. |
| `src/lib/scenes/compile-week.ts` | SIGHT slot 1: swap `word_match` → `lianliankan`. |
| `src/components/scenes/SceneRunner.tsx` | New `case 'lianliankan'` mounting `LianliankanScene`. |
| `scripts/migrate.ts` | Seed `('lianliankan'::scene_type, 1, '{}'::jsonb, true)` row after the schema migrate (same pattern as existing `image_word` seed). |
| `tests/unit/compile-week*.test.ts` | Assert `lianliankan` emitted in sight slot 1 instead of `word_match`. |
| `CLAUDE.md` | PR #57 entry + 3 landmines. |

### Untouched (locked)
- `src/components/scenes/WordMatchScene.tsx` — component file retained for old `scene_attempts` rows.
- `src/lib/scenes/configs.ts WordMatchConfigSchema` — retained.
- `src/components/scenes/SceneRunner.tsx case 'word_match'` — retained.

---

## Task 1: Add `LianliankanConfigSchema` to configs

**Files:**
- Modify: `src/lib/scenes/configs.ts`
- Test: covered indirectly via type usage in later tasks

- [ ] **Step 1.1: Append the schema**

In `src/lib/scenes/configs.ts`, after `WordMatchConfigSchema` (around line 46), add:

```ts
export const LianliankanConfigSchema = z.object({
  characterIds: z.array(z.string().uuid()).length(4),
  ...withSegment,
});
export type LianliankanConfig = z.infer<typeof LianliankanConfigSchema>;
```

Note: `.length(4)` — exactly 4 chars per spec §3. Not 2-6 like word_match.

- [ ] **Step 1.2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add src/lib/scenes/configs.ts
git commit -m "feat(pr57): LianliankanConfigSchema"
```

---

## Task 2: Pure path-finding library — types + `findPath`

**Files:**
- Create: `src/lib/scenes/lianliankan.ts`
- Test: `tests/unit/lianliankan-pathfinding.test.ts`

- [ ] **Step 2.1: Write failing tests for `findPath`**

Create `tests/unit/lianliankan-pathfinding.test.ts`:

```ts
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
  // ─ classic 6×4 board: 1-cell border + inner 4×2
  // outer row/col are always empty in compile-week emit, but tests can override
  const E = null;

  it('returns 2-cell path when from and to are adjacent on the same row', () => {
    const board = makeBoard(
      [
        [E, E, E, E, E, E],
        [E, 'A', 'B', E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
      ],
      (_) => 'p1', // every tile is pairId=p1 — so they "match"
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
    expect(path?.length).toBe(4); // (1,1)→(1,2)→(1,3)→(1,4)
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
    // Some valid L-shape; specific shape depends on BFS order but length ≥ 5.
  });

  it('returns Z-shape path (2 bends) when direct routes are blocked', () => {
    // (1,1) and (1,4) — direct horizontal blocked at (1,2) and (1,3)
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
    // Path routes around — through row 0 or row 2 — with exactly 2 bends.
  });

  it('returns null when path requires > 2 bends', () => {
    // Engineer a board where A→B needs 3+ bends.
    // (0,0) and (3,0), with blockers forcing zig-zag
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
    // A surrounded by X tiles → no path possible regardless of bend budget
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
    // Endpoint tiles ARE part of the path; if BFS rejects them as "not empty"
    // this test would fail.
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
    // (1,1)→(1,3) blocked by (1,2)=A2 which is same pairId
    const board = makeBoard(
      [
        [E, E, E, E, E, E],
        [E, 'A1', 'A2', 'A3', E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
      ],
      (_) => 'p1', // all share pairId
    );
    const path = findPath(board, { row: 1, col: 1 }, { row: 1, col: 3 });
    expect(path).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run + confirm failure**

```bash
pnpm vitest run tests/unit/lianliankan-pathfinding.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/scenes/lianliankan'`.

- [ ] **Step 2.3: Implement types + `findPath`**

Create `src/lib/scenes/lianliankan.ts`:

```ts
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

  // Seed the queue with 4 initial directions from `from`. The first move must
  // land on an empty cell (or `to` directly if adjacent).
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
      // Reached the destination?
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
```

- [ ] **Step 2.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/lianliankan-pathfinding.test.ts
```

Expected: PASS (all 9 tests).

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/scenes/lianliankan.ts tests/unit/lianliankan-pathfinding.test.ts
git commit -m "feat(pr57): pure findPath BFS with ≤2-bend constraint"
```

---

## Task 3: Board helpers — `hasValidPair`, `findOneValidPair`, `shuffleRemaining`, `buildInitialBoard`

**Files:**
- Modify: `src/lib/scenes/lianliankan.ts`
- Test: `tests/unit/lianliankan-board.test.ts`

- [ ] **Step 3.1: Write failing tests**

Create `tests/unit/lianliankan-board.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildInitialBoard,
  hasValidPair,
  findOneValidPair,
  shuffleRemaining,
  type CellContent,
  type LianliankanBoard,
} from '@/lib/scenes/lianliankan';

function deterministicRng(seed: number): () => number {
  // Mulberry32 — deterministic for tests
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('buildInitialBoard', () => {
  const chars = [
    { id: 'c1', hanzi: '鱼', meaningEn: 'fish' },
    { id: 'c2', hanzi: '海', meaningEn: 'sea' },
    { id: 'c3', hanzi: '山', meaningEn: 'mountain' },
    { id: 'c4', hanzi: '水', meaningEn: 'water' },
  ];

  it('produces a 6×4 board with 1-cell empty border and inner 4×2 tiles', () => {
    const board = buildInitialBoard(chars, deterministicRng(1));
    expect(board.rows).toBe(4);
    expect(board.cols).toBe(6);
    // Outer border must all be empty
    for (let c = 0; c < 6; c++) {
      expect(board.cells[0]![c]!.kind).toBe('empty');
      expect(board.cells[3]![c]!.kind).toBe('empty');
    }
    for (let r = 0; r < 4; r++) {
      expect(board.cells[r]![0]!.kind).toBe('empty');
      expect(board.cells[r]![5]!.kind).toBe('empty');
    }
    // Inner 4×2 must all be tiles
    let tileCount = 0;
    for (let r = 1; r <= 2; r++) {
      for (let c = 1; c <= 4; c++) {
        if (board.cells[r]![c]!.kind === 'tile') tileCount++;
      }
    }
    expect(tileCount).toBe(8);
  });

  it('places 4 hanzi + 4 meaning tiles, one of each per char', () => {
    const board = buildInitialBoard(chars, deterministicRng(1));
    const tiles: CellContent[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        tiles.push(board.cells[r]![c]!);
      }
    }
    const onlyTiles = tiles.filter((t) => t.kind === 'tile');
    expect(onlyTiles).toHaveLength(8);
    const hanziCount = onlyTiles.filter(
      (t) => t.kind === 'tile' && t.display.kind === 'hanzi',
    ).length;
    const meaningCount = onlyTiles.filter(
      (t) => t.kind === 'tile' && t.display.kind === 'meaning',
    ).length;
    expect(hanziCount).toBe(4);
    expect(meaningCount).toBe(4);
    // pair counts: each pairId should appear exactly twice
    const byPair = new Map<string, number>();
    for (const t of onlyTiles) {
      if (t.kind === 'tile') {
        byPair.set(t.pairId, (byPair.get(t.pairId) ?? 0) + 1);
      }
    }
    for (const count of byPair.values()) expect(count).toBe(2);
  });

  it('produces a board where at least one matchable pair has a valid path', () => {
    const board = buildInitialBoard(chars, deterministicRng(1));
    expect(hasValidPair(board)).toBe(true);
  });
});

describe('hasValidPair', () => {
  it('returns false on an all-empty board', () => {
    const board: LianliankanBoard = {
      rows: 4,
      cols: 6,
      cells: Array.from({ length: 4 }, () =>
        Array.from({ length: 6 }, (): CellContent => ({ kind: 'empty' })),
      ),
    };
    expect(hasValidPair(board)).toBe(false);
  });
});

describe('findOneValidPair', () => {
  it('returns null when no pairs exist', () => {
    const board: LianliankanBoard = {
      rows: 4,
      cols: 6,
      cells: Array.from({ length: 4 }, () =>
        Array.from({ length: 6 }, (): CellContent => ({ kind: 'empty' })),
      ),
    };
    expect(findOneValidPair(board)).toBeNull();
  });

  it('returns a valid pair from a fresh initial board', () => {
    const chars = [
      { id: 'c1', hanzi: '鱼', meaningEn: 'fish' },
      { id: 'c2', hanzi: '海', meaningEn: 'sea' },
      { id: 'c3', hanzi: '山', meaningEn: 'mountain' },
      { id: 'c4', hanzi: '水', meaningEn: 'water' },
    ];
    const board = buildInitialBoard(chars, deterministicRng(1));
    const pair = findOneValidPair(board);
    expect(pair).not.toBeNull();
    expect(pair!.fromTileId).not.toBe(pair!.toTileId);
  });
});

describe('shuffleRemaining', () => {
  it('preserves the set of remaining tiles', () => {
    const chars = [
      { id: 'c1', hanzi: '鱼', meaningEn: 'fish' },
      { id: 'c2', hanzi: '海', meaningEn: 'sea' },
      { id: 'c3', hanzi: '山', meaningEn: 'mountain' },
      { id: 'c4', hanzi: '水', meaningEn: 'water' },
    ];
    const board = buildInitialBoard(chars, deterministicRng(1));
    const before = collectTiles(board);
    const shuffled = shuffleRemaining(board, deterministicRng(7));
    const after = collectTiles(shuffled);
    expect(after.sort()).toEqual(before.sort());
  });

  it('produces a non-deadlock board', () => {
    const chars = [
      { id: 'c1', hanzi: '鱼', meaningEn: 'fish' },
      { id: 'c2', hanzi: '海', meaningEn: 'sea' },
      { id: 'c3', hanzi: '山', meaningEn: 'mountain' },
      { id: 'c4', hanzi: '水', meaningEn: 'water' },
    ];
    const board = buildInitialBoard(chars, deterministicRng(1));
    const shuffled = shuffleRemaining(board, deterministicRng(7));
    expect(hasValidPair(shuffled)).toBe(true);
  });
});

function collectTiles(board: LianliankanBoard): string[] {
  const ids: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cells[r]![c]!;
      if (cell.kind === 'tile') ids.push(cell.tileId);
    }
  }
  return ids;
}
```

- [ ] **Step 3.2: Confirm failure**

```bash
pnpm vitest run tests/unit/lianliankan-board.test.ts
```

Expected: FAIL — exports not defined.

- [ ] **Step 3.3: Append helpers to `src/lib/scenes/lianliankan.ts`**

Append to the existing file (after `findPath`):

```ts
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
    // Fisher-Yates shuffle the tiles array
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
  // Extremely unlikely: 32 random shuffles all deadlock. Return last attempt.
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
  // Empty 6×4
  const cells: CellContent[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 6 }, (): CellContent => ({ kind: 'empty' })),
  );

  // 8 tiles to place: 4 hanzi + 4 meaning
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

  // Inner 4×2 positions in (row, col) order
  const innerPositions: Cell[] = [];
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= 4; c++) innerPositions.push({ row: r, col: c });
  }

  // Try up to 32 shuffles to land on a non-deadlock initial state
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
    if (hasValidPair(board)) return board;
  }

  // Extremely unlikely: 32 random shuffles all deadlock. Return last attempt.
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

/**
 * Returns a NEW board with the two given tile positions cleared (set to empty).
 * Does not mutate the input.
 */
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
```

- [ ] **Step 3.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/lianliankan-board.test.ts tests/unit/lianliankan-pathfinding.test.ts
```

Expected: PASS — all tests across both files.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/scenes/lianliankan.ts tests/unit/lianliankan-board.test.ts
git commit -m "feat(pr57): board helpers — hasValidPair, shuffleRemaining, buildInitialBoard, clearTiles"
```

---

## Task 4: Schema migration 0019 — add `'lianliankan'` to scene_type enum

**Files:**
- Modify: `src/db/schema/game.ts`
- Modify: `scripts/migrate.ts` (seed the new template row)
- Create: `drizzle/0019_<name>.sql` (generated)

- [ ] **Step 4.1: Extend the enum**

In `src/db/schema/game.ts`, append to the `sceneType` enum (around line 31):

```ts
export const sceneType = pgEnum('scene_type', [
  'flashcard',
  'audio_pick',
  'visual_pick',
  'image_pick',
  'word_match',
  'tracing',
  'boss',
  'pinyin_pick',
  'translate_pick',
  'sentence_cloze',
  'image_word',
  'lianliankan',
]);
```

- [ ] **Step 4.2: Generate migration**

```bash
pnpm drizzle-kit generate
```

Expected: new file at `drizzle/0019_<adjective>_<noun>.sql` containing `ALTER TYPE "public"."scene_type" ADD VALUE 'lianliankan';` (or similar `ALTER TYPE … ADD VALUE`). Inspect to confirm — no destructive ops.

- [ ] **Step 4.3: Extend `scripts/migrate.ts` to seed the template row**

In `scripts/migrate.ts`, find the seed block (around line 32). Append `'lianliankan'` to the VALUES list:

```ts
      await sql`
        INSERT INTO scene_templates (type, version, default_config, is_active)
        SELECT * FROM (VALUES
            ('pinyin_pick'::scene_type,    1::smallint, '{}'::jsonb, true),
            ('translate_pick'::scene_type, 1::smallint, '{}'::jsonb, true),
            ('sentence_cloze'::scene_type, 1::smallint, '{}'::jsonb, true),
            ('image_word'::scene_type,     1::smallint, '{}'::jsonb, true),
            ('lianliankan'::scene_type,    1::smallint, '{}'::jsonb, true)
        ) AS new_rows(t, v, c, a)
        WHERE NOT EXISTS (
            SELECT 1 FROM scene_templates st
            WHERE st.type = new_rows.t AND st.version = new_rows.v
        )
      `;
      console.log('Scene-type seed applied (pinyin_pick / translate_pick / sentence_cloze / image_word / lianliankan)');
```

- [ ] **Step 4.4: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4.5: Commit**

```bash
git add src/db/schema/game.ts drizzle/0019_*.sql scripts/migrate.ts
git commit -m "feat(pr57): scene_type += 'lianliankan' (migration 0019 + seed)"
```

---

## Task 5: `LianliankanScene` component — render + tap mechanic

**Files:**
- Create: `src/components/scenes/LianliankanScene.tsx`
- Create: `src/components/scenes/fx/LianliankanLine.tsx`
- Test: `tests/unit/lianliankan-scene.test.tsx`

- [ ] **Step 5.1: Write failing tests**

Create `tests/unit/lianliankan-scene.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return {
    CoinHudContext: ctx,
    useCoinHud: () => useContext(ctx),
  };
});
vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { LianliankanScene } from '@/components/scenes/LianliankanScene';

const chars = [
  { characterId: 'c1', hanzi: '鱼', meaningEn: 'fish' },
  { characterId: 'c2', hanzi: '海', meaningEn: 'sea' },
  { characterId: 'c3', hanzi: '山', meaningEn: 'mountain' },
  { characterId: 'c4', hanzi: '水', meaningEn: 'water' },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LianliankanScene', () => {
  it('renders 8 tile buttons (4 hanzi + 4 meaning)', () => {
    render(<LianliankanScene chars={chars} onComplete={() => undefined} />);
    expect(screen.getByRole('button', { name: '鱼' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '海' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sea' })).toBeInTheDocument();
  });

  it('tapping the same tile twice deselects it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LianliankanScene chars={chars} onComplete={() => undefined} />);
    const fishHanzi = screen.getByRole('button', { name: '鱼' });
    await user.click(fishHanzi);
    expect(fishHanzi.getAttribute('aria-pressed')).toBe('true');
    await user.click(fishHanzi);
    expect(fishHanzi.getAttribute('aria-pressed')).toBe('false');
  });

  it('clearing all pairs calls onComplete(true)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onComplete = vi.fn();
    render(<LianliankanScene chars={chars} onComplete={onComplete} />);

    // Tap the hanzi then the meaning for each char
    for (const c of chars) {
      const hanziBtn = screen.getByRole('button', { name: c.hanzi });
      const meaningBtn = screen.getByRole('button', { name: c.meaningEn });
      await user.click(hanziBtn);
      await user.click(meaningBtn);
      // Wait for the clear timeout (600ms)
      act(() => { vi.advanceTimersByTime(700); });
    }

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('hintRequested highlights one valid pair', () => {
    const { container } = render(
      <LianliankanScene chars={chars} onComplete={() => undefined} hintRequested />,
    );
    // At least one tile should have the hint-highlight class
    expect(container.querySelector('[data-hint="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 5.2: Confirm failure**

```bash
pnpm vitest run tests/unit/lianliankan-scene.test.tsx
```

Expected: FAIL — component not exported.

- [ ] **Step 5.3: Implement `LianliankanLine` SVG overlay**

Create `src/components/scenes/fx/LianliankanLine.tsx`:

```tsx
'use client';

import { type Cell } from '@/lib/scenes/lianliankan';

interface Props {
  path: Cell[];
  cols: number;
  rows: number;
  cellPx: number;
}

export function LianliankanLine({ path, cols, rows, cellPx }: Props) {
  if (path.length < 2) return null;
  const points = path
    .map((p) => `${p.col * cellPx + cellPx / 2},${p.row * cellPx + cellPx / 2}`)
    .join(' ');
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      viewBox={`0 0 ${cols * cellPx} ${rows * cellPx}`}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="rgb(56,189,248)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 5.4: Implement `LianliankanScene`**

Create `src/components/scenes/LianliankanScene.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildInitialBoard,
  findOneValidPair,
  findPath,
  hasValidPair,
  shuffleRemaining,
  clearTiles,
  isAllCleared,
  type Cell,
  type LianliankanBoard,
} from '@/lib/scenes/lianliankan';
import { playSound } from '@/lib/audio/play';
import { LianliankanLine } from './fx/LianliankanLine';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  meaningEn: string;
}

interface Props {
  chars: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

const CELL_PX = 64; // logical units for the SVG overlay; CSS handles responsive sizing

export function LianliankanScene({ chars, onComplete, hintRequested }: Props) {
  const initialBoard = useMemo(
    () =>
      buildInitialBoard(
        chars.map((c) => ({ id: c.characterId, hanzi: c.hanzi, meaningEn: c.meaningEn })),
        Math.random,
      ),
    [chars],
  );
  const [board, setBoard] = useState<LianliankanBoard>(initialBoard);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [lastPath, setLastPath] = useState<Cell[] | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const hintPair = useMemo(
    () => (hintRequested ? findOneValidPair(board) : null),
    [hintRequested, board],
  );

  // After every clear, check for deadlock and auto-shuffle.
  useEffect(() => {
    if (isAllCleared(board)) return;
    if (!hasValidPair(board)) {
      setBoard((b) => shuffleRemaining(b, Math.random));
    }
  }, [board]);

  const onTileTap = (row: number, col: number) => {
    const cell = board.cells[row]?.[col];
    if (!cell || cell.kind !== 'tile') return;
    if (selected && selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }
    if (!selected) {
      setSelected({ row, col });
      return;
    }

    const sel = board.cells[selected.row]?.[selected.col];
    if (!sel || sel.kind !== 'tile') {
      setSelected({ row, col });
      return;
    }

    if (sel.pairId !== cell.pairId) {
      playSound('buzz');
      setShakeKey((k) => k + 1);
      setSelected(null);
      return;
    }

    const path = findPath(board, selected, { row, col });
    if (path === null) {
      playSound('buzz');
      setShakeKey((k) => k + 1);
      setSelected(null);
      return;
    }

    playSound('ding');
    setLastPath(path);
    const a = selected;
    const b = { row, col };
    setSelected(null);
    setTimeout(() => {
      setBoard((current) => clearTiles(current, a, b));
      setLastPath(null);
    }, 600);
  };

  useEffect(() => {
    if (isAllCleared(board) && !lastPath) {
      onComplete(true);
    }
  }, [board, lastPath, onComplete]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <div
        className="relative grid"
        data-shake-key={shakeKey}
        style={{
          gridTemplateColumns: `repeat(${board.cols}, clamp(48px, 14vw, 72px))`,
          gridTemplateRows: `repeat(${board.rows}, clamp(48px, 14vw, 72px))`,
          gap: 4,
        }}
      >
        {board.cells.flatMap((row, r) =>
          row.map((cell, c) => {
            if (cell.kind === 'empty') {
              return <div key={`${r}-${c}`} aria-hidden />;
            }
            const isSelected =
              selected?.row === r && selected?.col === c;
            const isHinted =
              hintPair?.fromTileId === cell.tileId ||
              hintPair?.toTileId === cell.tileId;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-pressed={isSelected}
                data-hint={isHinted ? 'true' : undefined}
                onClick={() => onTileTap(r, c)}
                className={[
                  'flex items-center justify-center rounded-2xl border-2 shadow-sm transition-transform active:scale-95',
                  cell.display.kind === 'hanzi'
                    ? 'bg-[var(--color-sand-100)] font-hanzi text-4xl text-[var(--color-ocean-900)]'
                    : 'bg-amber-100 text-sm font-semibold text-amber-900',
                  isSelected
                    ? 'border-sky-400 ring-4 ring-sky-200'
                    : 'border-[var(--color-sand-300)]',
                  isHinted ? 'animate-pulse' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {cell.display.text}
              </button>
            );
          }),
        )}
        {lastPath ? (
          <LianliankanLine
            path={lastPath}
            cols={board.cols}
            rows={board.rows}
            cellPx={CELL_PX}
          />
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5.5: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/lianliankan-scene.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 5.6: Commit**

```bash
git add src/components/scenes/LianliankanScene.tsx src/components/scenes/fx/LianliankanLine.tsx tests/unit/lianliankan-scene.test.tsx
git commit -m "feat(pr57): LianliankanScene + connecting-line SVG overlay"
```

---

## Task 6: Wire `LianliankanScene` into `SceneRunner`

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx`

- [ ] **Step 6.1: Locate the scene switch**

Run: `grep -n "case 'word_match'" src/components/scenes/SceneRunner.tsx`

Note the surrounding `case` blocks for pattern.

- [ ] **Step 6.2: Add import + case**

Open `src/components/scenes/SceneRunner.tsx`.

Add the import (near the other scene imports at the top):

```tsx
import { LianliankanScene } from './LianliankanScene';
```

Find the `SceneType` union and append `| 'lianliankan'` so TypeScript accepts the new value.

Find the scene switch (`switch (currentLevel.sceneType)`). Below the existing `case 'word_match':` block, add:

```tsx
    case 'lianliankan': {
      const characterIds = currentLevel.config.characterIds as string[] | undefined;
      if (!characterIds || characterIds.length !== 4) {
        body = <MissingData />;
        break;
      }
      const resolved = characterIds
        .map((id) => charactersById[id])
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      body =
        resolved.length === 4 ? (
          <LianliankanScene
            key={currentLevel.id}
            chars={resolved.map((c) => ({
              characterId: c.characterId,
              hanzi: c.hanzi,
              meaningEn: c.meaningEn ?? '',
            }))}
            onComplete={advance}
            hintRequested={hintRequested}
          />
        ) : (
          <MissingData />
        );
      break;
    }
```

- [ ] **Step 6.3: Run tests + typecheck**

```bash
pnpm typecheck
pnpm vitest run
```

Expected: PASS — including any SceneRunner-level tests that already check scene routing.

- [ ] **Step 6.4: Commit**

```bash
git add src/components/scenes/SceneRunner.tsx
git commit -m "feat(pr57): wire LianliankanScene into SceneRunner"
```

---

## Task 7: `compile-week.ts` — swap word_match → lianliankan in sight slot 1

**Files:**
- Modify: `src/lib/scenes/compile-week.ts`
- Test: locate the existing compile-week test file (`grep -rl 'computePracticeSizing\|compileWeekIntoLevels' tests/`).

- [ ] **Step 7.1: Add failing tests**

In the compile-week test file, add:

```ts
describe('compile-week PR #57 lianliankan slot', () => {
  it('emits a lianliankan level in sight slot 1 for a 10-char week', async () => {
    const levels = await runCompileForCharCount(10); // existing helper
    expect(levels.some((l) => l.sceneType === 'lianliankan')).toBe(true);
  });

  it('does NOT emit any word_match level (post-PR-#57 retirement)', async () => {
    const levels = await runCompileForCharCount(10);
    expect(levels.filter((l) => l.sceneType === 'word_match')).toHaveLength(0);
  });
});
```

If the existing test harness uses a different fixture helper, adapt — read the existing tests first.

- [ ] **Step 7.2: Confirm failure**

```bash
pnpm vitest run
```

Expected: FAIL — current compile still emits word_match.

- [ ] **Step 7.3: Update the SIGHT block**

In `src/lib/scenes/compile-week.ts`, locate the SIGHT block (around line 117). Replace the `word_match` slot logic with `lianliankan`:

```ts
  // ── SIGHT ───────────────────────────────────────────────────────────────
  if (sizing.sight > 0) {
    const imageId = tmplByType.get('image_pick');
    const lianliankanId = tmplByType.get('lianliankan');
    const usedCharIds = new Set<string>();

    // image_pick (slot 0)
    if (sizing.sight >= 1 && imageId) {
      const withHook = chars.filter((c) => Boolean(c.imageHook));
      if (withHook.length > 0) {
        const target = pickRandom(withHook);
        usedCharIds.add(target.id);
        push(
          imageId,
          { characterId: target.id },
          'sight',
          'practice:image_pick:0',
        );
      }
    }

    // lianliankan (slot 1 — multi-char, exactly 4 chars with meaningEn)
    if (sizing.sight >= 2 && lianliankanId) {
      const withMeaning = chars.filter((c) => Boolean(c.meaningEn));
      const sample = shuffle(withMeaning).slice(0, 4);
      if (sample.length === 4) {
        push(
          lianliankanId,
          { characterIds: sample.map((c) => c.id) },
          'sight',
          'practice:lianliankan:0',
        );
      }
      // If fewer than 4 chars with meaningEn, slot stays unfilled.
      // word_match fallback intentionally NOT added — word_match is retired.
    }

    // ── image_word slots (unchanged from PR #51) ──────────────────────────
    // ... existing image_word logic stays as-is
  }
```

The `image_word` block AFTER the `lianliankan` slot stays untouched.

- [ ] **Step 7.4: Run tests + confirm pass**

```bash
pnpm vitest run
```

Expected: PASS — including the new PR #57 tests and any existing compile-week tests adapted to the new scene type. If existing tests assert exact word_match-related strings, update them.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/scenes/compile-week.ts tests/
git commit -m "feat(pr57): compile-week emits lianliankan in sight slot 1"
```

---

## Task 8: Retire script — `scripts/retire-word-match.ts`

**Files:**
- Create: `scripts/retire-word-match.ts`
- Test: `tests/unit/retire-word-match.test.ts`

- [ ] **Step 8.1: Write failing test**

Create `tests/unit/retire-word-match.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('retire-word-match script', () => {
  it('updates scene_templates.is_active to false for type=word_match', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 't1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    vi.doMock('@/db', () => ({
      db: { update },
    }));

    const { retireWordMatch } = await import('../../scripts/retire-word-match');
    const result = await retireWordMatch();

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ isActive: false });
    expect(result.updated).toBe(1);
  });
});
```

- [ ] **Step 8.2: Confirm failure**

```bash
pnpm vitest run tests/unit/retire-word-match.test.ts
```

Expected: FAIL — file not found.

- [ ] **Step 8.3: Implement the script**

Create `scripts/retire-word-match.ts`:

```ts
/**
 * Retire the `word_match` scene template by flipping its `is_active` flag
 * to false. Same idempotent pattern as scripts/retire-visual-pick.ts.
 *
 * Usage:
 *   pnpm tsx scripts/retire-word-match.ts
 *
 * Idempotent: re-running has no effect on already-retired rows.
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

export async function retireWordMatch(): Promise<{ updated: number }> {
  const { db } = await import('@/db');
  const { sceneTemplates } = await import('@/db/schema/game');

  const result = await db
    .update(sceneTemplates)
    .set({ isActive: false })
    .where(eq(sceneTemplates.type, 'word_match'))
    .returning({ id: sceneTemplates.id });

  return { updated: result.length };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const { updated } = await retireWordMatch();

  if (updated === 0) {
    console.log('[retire-word-match] No word_match scene_template found — nothing to do.');
  } else {
    console.log(`[retire-word-match] flipped ${updated} row(s) to is_active=false`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[retire-word-match] failed:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 8.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/retire-word-match.test.ts
```

Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add scripts/retire-word-match.ts tests/unit/retire-word-match.test.ts
git commit -m "feat(pr57): ops script to retire word_match template"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 9.1: Bump refresh date**

Find the line `## Current state (last refreshed YYYY-MM-DD)` and change date to today's date.

- [ ] **Step 9.2: Append PR #57 entry**

After the last existing PR entry in "Current state", append:

```markdown
- **PR #57 (shipped YYYY-MM-DD)** — Lianliankan replacement for WordMatchScene. Old `word_match` (confusing N-to-N hanzi+word multi-pick) replaced by a 连连看 puzzle in sight slot 1. Board: 6×4 with 1-cell empty border, inner 4×2 playable = 4 pairs. Each pair = 1 hanzi tile + 1 English-meaning tile (Yinuo is English-native so meanings are readable). Classic ≤2-bend path rule via pure `findPath` BFS in `src/lib/scenes/lianliankan.ts` — fully tested independently of UI. New scene_type enum value `'lianliankan'` (migration 0019) + seed in `scripts/migrate.ts`. `word_match` template flipped to `is_active=false` via new `scripts/retire-word-match.ts` (same retirement pattern as `pinyin_pick` PR #35 + `visual_pick` PR #51). `WordMatchScene` component + `WordMatchConfigSchema` + SceneRunner case all retained for backwards-compat with old `scene_attempts` rows. Auto-shuffle on deadlock; 💡 hint highlights one valid pair. Tile size `clamp(48px, 14vw, 72px)`. Recompile required post-merge.
```

(Fill in the date and final `+N tests` after verify.)

- [ ] **Step 9.3: Append 3 landmines**

Append to the Landmines section:

```markdown
- **Lianliankan path-finding endpoints are tiles, not empty.** PR #57's `findPath` BFS allows the start (`from`) and end (`to`) cells to contain tiles (they're the matchees) but every intermediate cell MUST be empty. Common refactoring bug: tightening the "must be empty" check to include endpoints, which breaks every match. Tests `treats endpoints as tiles` + `returns null when intermediate cell has any tile (even of same pair)` guard this. Don't relax the test wording without thinking.
- **`word_match` template stays in DB after PR #57.** Same pattern as `pinyin_pick` (PR #35) and `visual_pick` (PR #51): `scripts/retire-word-match.ts` flips `scene_templates.is_active=false`, `compile-week.ts` no longer emits `word_match` in sight slot 1, but the component file (`WordMatchScene.tsx`), config schema (`WordMatchConfigSchema`), and SceneRunner case all REMAIN for backwards compat with old `scene_attempts` rows. If you ever re-enable, flip `is_active=true` AND re-add slot logic.
- **Lianliankan board has a 1-cell empty border by design.** The inner 4×2 (8 cells = 4 pairs) is wrapped by an outer ring of empty cells so paths can route around remaining tiles. Don't "optimize" by dropping the border — it makes many Z-bend paths impossible and turns the game into trivial straight-line matching.
```

- [ ] **Step 9.4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #57 (Lianliankan) + landmines"
```

---

## Task 10: Verify + push + open PR

- [ ] **Step 10.1: Run four-green gate**

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all 4 green.

- [ ] **Step 10.2: Backfill test count in CLAUDE.md**

Compare test count vs baseline (659). Update the `YYYY-MM-DD` and `+N tests` placeholders in the PR #57 CLAUDE.md entry to the actual values. Commit:

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): backfill PR #57 date + test count"
```

- [ ] **Step 10.3: Manual dev smoke**

```bash
pnpm dev
```

Walk through:
1. Sign in → enter a week's practice section
2. Lianliankan appears in sight slot (after image_pick, before image_word)
3. Tap hanzi + matching meaning → connecting line draws → both clear
4. Tap two non-matching tiles → red flash + shake, no clear
5. Engineer a near-deadlock state and confirm auto-shuffle
6. Trigger hint powerup → one valid pair pulses

- [ ] **Step 10.4: Push + open PR**

```bash
git push -u origin feat/pr57-lianliankan
gh pr create --title "feat(pr57): Lianliankan replacement for WordMatchScene" --body "$(cat <<'EOF'
## Summary

Replaces the confusing `word_match` scene with a 连连看 (Lianliankan) puzzle in sight slot 1. Each pair = 1 hanzi tile + 1 English-meaning tile; tap two matching tiles to clear if connected by a ≤2-bend path through empty cells.

## Mechanic
- 6×4 board with 1-cell empty border for path routing
- Inner 4×2 = 8 tiles = 4 pairs of (hanzi ↔ English meaning)
- Classic Lianliankan: orthogonal segments only, ≤2 right-angle bends
- Auto-shuffle on deadlock; 💡 hint highlights one valid pair

## Architecture
- Pure `findPath` BFS in `src/lib/scenes/lianliankan.ts` — fully testable independently of UI
- Migration 0019 extends `scene_type` enum + seeds the template
- `word_match` template flipped to `is_active=false` via new ops script (same retirement pattern as `pinyin_pick`/`visual_pick`)
- Recompile required post-merge

## Test plan

- [ ] Lianliankan appears in sight slot 1 (not word_match)
- [ ] Tap hanzi + matching meaning with clear path → both clear with connecting line
- [ ] Tap two non-matching → red flash + shake, no clear
- [ ] Clear all 4 pairs → next level advances
- [ ] Hint powerup → one valid pair pulses
- [ ] Deadlock auto-shuffles

## Post-merge ops

```bash
pnpm tsx scripts/retire-word-match.ts
pnpm tsx scripts/recompile-all-weeks.ts
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10.5: Post-merge prod ops**

After PR merges:
```bash
pnpm tsx scripts/retire-word-match.ts
pnpm tsx scripts/recompile-all-weeks.ts
```

(Confirm with David before running.)

---

## Self-review (controller checklist)

Spec coverage:

| Spec § | Item | Task |
|---|---|---|
| 4.1 / Board representation | Types + 6×4 layout | Tasks 2, 3 |
| 4.2 / Pure helpers | findPath / hasValidPair / findOneValidPair / shuffleRemaining / buildInitialBoard / clearTiles / isAllCleared | Tasks 2, 3 |
| 4.3 / Component | LianliankanScene + tap mechanic + animations | Task 5 |
| 4.4 / Scene type | enum + template + config schema | Tasks 1, 4 |
| 4.4 / compile-week | Slot 1 swap | Task 7 |
| 4.5 / SceneRunner + retirement | Case wire + retire script | Tasks 6, 8 |
| 5 / UX details | tile size, selected/hint styles, ShakeWrap, line animation | Task 5 |
| 6 / Tests | enumerated | Tasks 2, 3, 5, 7, 8 |
| 7 / Verification | Four-green + dev smoke | Task 10 |
| 8 / v2 deferrals | Not implemented (out of scope) | n/a |
| 9 / Landmines | Documented | Task 9 |
| 10 / Rollout | Post-merge retire + recompile | Task 10 |

Placeholder scan: every step has full code or commands.

Type consistency:
- `LianliankanBoard`, `CellContent`, `Cell` defined in Task 2, used consistently in Tasks 3, 5, 6.
- `buildInitialBoard(chars, rng)` signature stable between Tasks 3 and 5.
- `findPath(board, from, to)` signature stable across Tasks 2, 3, 5.
- `'lianliankan'` enum value used identically across schema (Task 4), config schema (Task 1), compile-week (Task 7), SceneRunner case (Task 6).

Plan is internally consistent and ready for execution.
