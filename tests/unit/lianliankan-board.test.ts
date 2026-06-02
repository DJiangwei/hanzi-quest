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
    for (let c = 0; c < 6; c++) {
      expect(board.cells[0]![c]!.kind).toBe('empty');
      expect(board.cells[3]![c]!.kind).toBe('empty');
    }
    for (let r = 0; r < 4; r++) {
      expect(board.cells[r]![0]!.kind).toBe('empty');
      expect(board.cells[r]![5]!.kind).toBe('empty');
    }
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
