import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Schema mock: fake table objects ───────────────────────────────────────────
vi.mock('@/db/schema', () => {
  const t = (name: string) => ({ __name: name });
  return {
    homePlacements: t('home_placements'),
    shopItems: t('shop_items'),
    shopPurchases: t('shop_purchases'),
  };
});

// ── Shared mutable state driven by each test ─────────────────────────────────
const state = vi.hoisted(() => ({
  // for placeFurnitureInTx tx.select calls:
  //   call 1 = ownership count check
  //   call 2 = existing placements in room
  ownedCount: 0,
  existingRoomPlacements: [] as Array<{ slug: string; copyIndex?: number; x: number; y: number }>,

  // for getHomeState db.select calls:
  //   call 1 = owned slugs
  //   call 2 = placements
  ownedSlugs: [] as string[],
  allPlacements: [] as Array<{ room: string; slug: string; x: number; y: number }>,

  // capture insert/delete calls
  insertValues: null as null | Record<string, unknown>,
  deleteCalled: false,

  // tx selectIdx reset token
  txSelectIdx: 0,
}));

vi.mock('@/db', () => {
  // Flexible chain that terminates with a promise via .then()
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {};
    const ret = () => c;
    c.from = ret;
    c.innerJoin = ret;
    c.where = ret;
    c.limit = ret;
    c.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(data));
    return c;
  };

  // ── tx (used directly in placeFurnitureInTx / removeFurnitureInTx tests) ──
  const tx = {
    select: vi.fn().mockImplementation(() => {
      state.txSelectIdx++;
      if (state.txSelectIdx === 1) {
        // Ownership count query
        return chain([{ count: state.ownedCount }]);
      }
      // Existing placements in room
      return chain(state.existingRoomPlacements);
    }),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        state.insertValues = vals;
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        state.deleteCalled = true;
        return Promise.resolve();
      }),
    })),
  };

  // ── db (used in getHomeState / getOwnedFurnitureSlugs top-level calls) ──
  let dbSelectIdx = 0;
  const db = {
    select: vi.fn().mockImplementation(() => {
      dbSelectIdx++;
      if (dbSelectIdx % 2 === 1) {
        // Odd = owned slugs query
        return chain(state.ownedSlugs.map((slug) => ({ slug })));
      }
      // Even = placements query
      return chain(state.allPlacements);
    }),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      state.txSelectIdx = 0; // reset for each transaction
      return fn(tx);
    }),
    _tx: tx,
    _resetDbIdx: () => { dbSelectIdx = 0; },
  };

  return { db };
});

import {
  getHomeState,
  placeFurnitureInTx,
  removeFurnitureInTx,
} from '@/lib/db/home';
import {
  FurnitureNotOwnedError,
  CellOccupiedError,
  InvalidPlacementError,
} from '@/lib/errors/home-errors';
import {
  cellsForFootprint,
  validCells,
  cellKey,
} from '@/lib/home/grid';
import { getRoom } from '@/lib/home/rooms';

// Get the tx from the mock for direct use in tests
const { db: dbMock } = await import('@/db') as unknown as {
  db: {
    _tx: Record<string, ReturnType<typeof vi.fn>>;
    _resetDbIdx: () => void;
    transaction: ReturnType<typeof vi.fn>;
  };
};
const tx = dbMock._tx;

beforeEach(() => {
  // Reset all scenario state
  state.ownedCount = 0;
  state.existingRoomPlacements = [];
  state.ownedSlugs = [];
  state.allPlacements = [];
  state.insertValues = null;
  state.deleteCalled = false;
  state.txSelectIdx = 0;
  dbMock._resetDbIdx();
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// grid.ts pure helpers
// ────────────────────────────────────────────────────────────────────────────

describe('cellsForFootprint', () => {
  it('1×1 footprint at (0,0) returns [(0,0)]', () => {
    expect(cellsForFootprint(0, 0, { w: 1, h: 1 })).toEqual([{ x: 0, y: 0 }]);
  });

  it('2×1 footprint at (3,2) returns [(3,2),(4,2)]', () => {
    expect(cellsForFootprint(3, 2, { w: 2, h: 1 })).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it('2×2 footprint at (1,1) returns 4 cells', () => {
    const cells = cellsForFootprint(1, 1, { w: 2, h: 2 });
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ x: 1, y: 1 });
    expect(cells).toContainEqual({ x: 2, y: 1 });
    expect(cells).toContainEqual({ x: 1, y: 2 });
    expect(cells).toContainEqual({ x: 2, y: 2 });
  });
});

describe('validCells', () => {
  const bedroom = getRoom('bedroom')!;

  it('finds floor positions for a 1×1 floor item (no occupied)', () => {
    const positions = validCells(bedroom, { w: 1, h: 1 }, 'floor', new Set());
    // rows 2-5 × cols 0-7 = 32 positions
    expect(positions.length).toBe(32);
    for (const p of positions) {
      expect(p.y).toBeGreaterThanOrEqual(bedroom.wallRows);
    }
  });

  it('finds wall positions for a 1×1 wall item (no occupied)', () => {
    const positions = validCells(bedroom, { w: 1, h: 1 }, 'wall', new Set());
    // rows 0-1 × cols 0-7 = 16 positions
    expect(positions.length).toBe(16);
    for (const p of positions) {
      expect(p.y).toBeLessThan(bedroom.wallRows);
    }
  });

  it('a 2×1 floor item — 7×4 = 28 valid floor positions', () => {
    const positions = validCells(bedroom, { w: 2, h: 1 }, 'floor', new Set());
    expect(positions.length).toBe(28);
  });

  it('excludes occupied cells', () => {
    const occupied = new Set(['0,2', '1,2']);
    const positions = validCells(bedroom, { w: 1, h: 1 }, 'floor', occupied);
    expect(positions.length).toBe(30);
    expect(positions.every((p) => !occupied.has(cellKey(p.x, p.y)))).toBe(true);
  });

  it('2×1 item is excluded when either cell is occupied', () => {
    const occupied = new Set(['1,2']);
    const positions = validCells(bedroom, { w: 2, h: 1 }, 'floor', occupied);
    expect(positions.every((p) => !(p.x === 0 && p.y === 2))).toBe(true);
    expect(positions.every((p) => !(p.x === 1 && p.y === 2))).toBe(true);
  });
});

describe('cellKey', () => {
  it('encodes coords as "x,y" string', () => {
    expect(cellKey(3, 5)).toBe('3,5');
    expect(cellKey(0, 0)).toBe('0,0');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// home-errors.ts
// ────────────────────────────────────────────────────────────────────────────

describe('FurnitureNotOwnedError', () => {
  it('is an Error with the right name and slug', () => {
    const err = new FurnitureNotOwnedError('bed-cozy');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FurnitureNotOwnedError');
    expect(err.slug).toBe('bed-cozy');
    expect(err.message).toContain('bed-cozy');
  });
});

describe('CellOccupiedError', () => {
  it('is an Error with room + coordinates', () => {
    const err = new CellOccupiedError('bedroom', 3, 4);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CellOccupiedError');
    expect(err.room).toBe('bedroom');
    expect(err.x).toBe(3);
    expect(err.y).toBe(4);
  });
});

describe('InvalidPlacementError', () => {
  it('is an Error with reason', () => {
    const err = new InvalidPlacementError('out of bounds');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidPlacementError');
    expect(err.reason).toBe('out of bounds');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getHomeState
// ────────────────────────────────────────────────────────────────────────────

describe('getHomeState', () => {
  it('returns empty state for child with nothing', async () => {
    const result = await getHomeState('c1');
    expect(result.ownedSlugs).toEqual([]);
    expect(result.placements).toEqual([]);
  });

  it('returns owned slugs from shop_purchases', async () => {
    state.ownedSlugs = ['chair-wood', 'rug-round'];
    const result = await getHomeState('c1');
    expect(result.ownedSlugs).toEqual(['chair-wood', 'rug-round']);
  });

  it('returns placements', async () => {
    state.allPlacements = [
      { room: 'bedroom', slug: 'chair-wood', x: 2, y: 3 },
    ];
    const result = await getHomeState('c1');
    expect(result.placements).toEqual([
      { room: 'bedroom', slug: 'chair-wood', x: 2, y: 3 },
    ]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// placeFurnitureInTx — validation failures
// ────────────────────────────────────────────────────────────────────────────

describe('placeFurnitureInTx — validation failures', () => {
  it('throws InvalidPlacementError for unknown slug', async () => {
    // Even if "owned" count > 0, the slug doesn't exist in catalog
    state.ownedCount = 1;
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'nonexistent-item', 0, 2),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('throws FurnitureNotOwnedError when child does not own the item', async () => {
    state.ownedCount = 0; // not owned
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 0, 2),
    ).rejects.toThrow(FurnitureNotOwnedError);
  });

  it('throws InvalidPlacementError for unknown room', async () => {
    state.ownedCount = 1;
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'atlantis', 'chair-wood', 0, 2),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('throws InvalidPlacementError for out-of-bounds x', async () => {
    state.ownedCount = 1;
    state.existingRoomPlacements = [];
    // x=8 with 1×1 footprint → out of bounds (cols=8 means 0-7)
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 8, 2),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('throws InvalidPlacementError for out-of-bounds y', async () => {
    state.ownedCount = 1;
    state.existingRoomPlacements = [];
    // y=6 → out of bounds (rows=6 means 0-5)
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 0, 6),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('throws InvalidPlacementError when placing a floor item in wall zone (y<2)', async () => {
    state.ownedCount = 1; // chair-wood is surface='floor'
    state.existingRoomPlacements = [];
    // y=0 is wall zone
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 0, 0),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('throws InvalidPlacementError when placing a wall item in floor zone (y>=2)', async () => {
    state.ownedCount = 1; // poster-stars is surface='wall'
    state.existingRoomPlacements = [];
    // y=3 is floor zone
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'poster-stars', 0, 3),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('throws CellOccupiedError when another item occupies the target cell', async () => {
    state.ownedCount = 1; // chair-wood owned
    // Existing 'table-round' at (2,3) — 1×1 floor, same cell
    state.existingRoomPlacements = [{ slug: 'table-round', copyIndex: 0, x: 2, y: 3 }];
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 2, 3),
    ).rejects.toThrow(CellOccupiedError);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// placeFurnitureInTx — happy path
// ────────────────────────────────────────────────────────────────────────────

describe('placeFurnitureInTx — happy path', () => {
  it('upserts a valid floor item placement', async () => {
    state.ownedCount = 1;
    state.existingRoomPlacements = [];
    await placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 0, 2);
    expect(state.insertValues).toMatchObject({
      childId: 'c1',
      room: 'bedroom',
      furnitureSlug: 'chair-wood',
      gridX: 0,
      gridY: 2,
    });
  });

  it('upserts a valid wall item placement (y=0)', async () => {
    state.ownedCount = 1;
    state.existingRoomPlacements = [];
    await placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'poster-stars', 3, 0);
    expect(state.insertValues).toMatchObject({
      childId: 'c1',
      room: 'bedroom',
      furnitureSlug: 'poster-stars',
      gridX: 3,
      gridY: 0,
    });
  });

  it('allows moving the same item to a new position — skips self in collision check', async () => {
    state.ownedCount = 1;
    // Same slug 'chair-wood' already placed at (0,2) — should be skipped in collision check
    state.existingRoomPlacements = [{ slug: 'chair-wood', copyIndex: 0, x: 0, y: 2 }];
    // Move to (1,2) — no collision with self
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 1, 2),
    ).resolves.toBeUndefined();
    expect(state.insertValues).toMatchObject({ furnitureSlug: 'chair-wood', gridX: 1, gridY: 2 });
  });

  it('allows placing a 2×1 item when cells are free', async () => {
    state.ownedCount = 1; // bed-cozy: 2×1, floor
    state.existingRoomPlacements = [];
    await placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'bed-cozy', 0, 2);
    expect(state.insertValues).toMatchObject({
      furnitureSlug: 'bed-cozy',
      gridX: 0,
      gridY: 2,
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// removeFurnitureInTx
// ────────────────────────────────────────────────────────────────────────────

describe('placeFurnitureInTx — E3 multi-buy copies', () => {
  it('rejects a copyIndex outside 0..cap-1', async () => {
    state.ownedCount = 3;
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 0, 2, 3),
    ).rejects.toThrow(InvalidPlacementError);
  });

  it('placing copy #1 requires owning 2 copies', async () => {
    state.ownedCount = 1;
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 0, 2, 1),
    ).rejects.toThrow(FurnitureNotOwnedError);
  });

  it('places a second owned copy with its copyIndex persisted', async () => {
    state.ownedCount = 2;
    state.existingRoomPlacements = [{ slug: 'chair-wood', copyIndex: 0, x: 0, y: 2 }];
    await placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 1, 2, 1);
    expect(state.insertValues).toMatchObject({
      furnitureSlug: 'chair-wood',
      copyIndex: 1,
      gridX: 1,
      gridY: 2,
    });
  });

  it('a second copy of the same slug still blocks cells (only the moved copy is skipped)', async () => {
    state.ownedCount = 2;
    state.existingRoomPlacements = [
      { slug: 'chair-wood', copyIndex: 0, x: 2, y: 3 },
      { slug: 'chair-wood', copyIndex: 1, x: 3, y: 3 },
    ];
    // Move copy 0 onto copy 1's cell → collision (self-skip must be per-copy)
    await expect(
      placeFurnitureInTx(tx as never, 'c1', 'bedroom', 'chair-wood', 3, 3, 0),
    ).rejects.toThrow(CellOccupiedError);
  });
});

describe('removeFurnitureInTx', () => {
  it('calls delete on homePlacements for the given child + slug', async () => {
    await removeFurnitureInTx(tx as never, 'c1', 'chair-wood');
    expect(state.deleteCalled).toBe(true);
  });

  it('resolves without error even when slug is not placed', async () => {
    await expect(
      removeFurnitureInTx(tx as never, 'c1', 'nonexistent'),
    ).resolves.toBeUndefined();
  });
});
