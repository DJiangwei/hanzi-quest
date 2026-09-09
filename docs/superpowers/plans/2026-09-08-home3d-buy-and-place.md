# 3D home — buy and place as one flow: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the child pick a piece in the shop, see it ghosted in the 3D room, put it down, and buy-and-place it with one confirm — in one transaction.

**Architecture:** Extract the pure half of `placeFurnitureInTx`'s validation into a client-safe `canPlaceAt` so the 3D scene's green/red cells and the server's acceptance come from ONE function. Add `worldToCell` (inverse of the existing `cellToWorld`) so a tap on the floor resolves to a grid cell. Compose the two existing `*InTx` helpers — purchase first, then place — inside one `db.transaction`, mapping thrown errors to a discriminated outcome OUTSIDE the transaction.

**Tech Stack:** Next.js 16 App Router, React 19, react-three-fiber 9.7 + drei, Drizzle/Neon, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-08-home3d-buy-and-place-design.md`

## Global Constraints

- **The 2D room keeps its editor.** This is additive. WebGL can fail on her iPad and a decorated home must stay visible and editable.
- **Bilingual chrome:** every new kid-facing label is `中文 / English`, ZH first (`bi()` or a ZH+EN span pair).
- **`'use server'` files export only async functions.** Pure helpers and error classes live elsewhere.
- **Never pass function-bearing objects from a server component into a client one** (the `PackUiMeta` RSC hazard). Pass slugs.
- **Server re-validates everything.** `canPlaceAt` being shared is about the two never disagreeing, never about trusting the client.
- **Reduced motion:** any new animation must respect `useReducedMotion()`.
- **No rotation, no camera control, no 3D shop thumbnails** (WebGL context ceiling — see spec).
- Grid is **8 cols × 6 rows**, `wallRows = 2`. 3D constants in `HomeRoom3D.tsx`: `COLS = 8`, `ROWS = 6`, `WALL_ROWS = 2`, `FLOOR_ROWS = ROWS - WALL_ROWS = 4`.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green at PR open.

---

## File Structure

| file | responsibility |
|---|---|
| `src/lib/home/placement-rules.ts` | **new.** Pure `canPlaceAt` — bounds, surface zone, collision. No `@/db`. |
| `src/lib/home3d/coords.ts` | **new.** `worldToCell`, inverse of `cellToWorld`. Pure. |
| `src/lib/db/home.ts` | `placeFurnitureInTx` delegates steps 4–6 to `canPlaceAt`. |
| `src/lib/actions/home.ts` | **new** `buyAndPlaceFurnitureAction`. |
| `src/components/home3d/HomeRoom3D.tsx` | optional `ghost` + `onFloorPick`; view-only when absent. |
| `src/components/home3d/Room3DPanel.tsx` | edit state: selected piece, ghost cell, confirm bar. |
| `src/components/home3d/GhostPiece.tsx` | **new.** Translucent piece + green/red footprint tiles. |

---

### Task 1: Pure placement rules

**Files:**
- Create: `src/lib/home/placement-rules.ts`
- Test: `tests/unit/placement-rules.test.ts`

**Interfaces:**
- Produces: `canPlaceAt(roomId, slug, x, y, placements, ignoreCopyIndex?) → PlacementVerdict`, where `PlacementVerdict = { ok: true } | { ok: false; reason: 'unknown-room' | 'unknown-slug' | 'out-of-bounds' | 'wrong-surface' | 'occupied'; cell?: {x,y} }`
- Consumes: `getRoom`, `cellZone` from `@/lib/home/rooms`; `cellsForFootprint`, `cellKey` from `@/lib/home/grid`; `getFurniture` from `@/lib/home/furniture-catalog`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/placement-rules.test.ts
import { describe, it, expect } from 'vitest';
import { canPlaceAt } from '@/lib/home/placement-rules';

// 'rug-round' is a floor item; the top 2 rows of every room are the wall zone.
const NONE: { slug: string; copyIndex: number; gridX: number; gridY: number }[] = [];

describe('canPlaceAt', () => {
  it('accepts a floor item in the floor zone', () => {
    expect(canPlaceAt('bedroom', 'rug-round', 2, 3, NONE)).toEqual({ ok: true });
  });

  it('rejects a floor item placed in the wall zone', () => {
    const v = canPlaceAt('bedroom', 'rug-round', 2, 0, NONE);
    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ reason: 'wrong-surface' });
  });

  it('rejects a footprint that runs off the right edge', () => {
    // Verified against the catalog: bed-cozy is 2x1 and the grid is 8 wide, so
    // x=7 gives 7+2=9 > 8. Do not swap in a 1x1 item here — it would fit, and
    // the test would pass against a broken bounds check.
    const v = canPlaceAt('bedroom', 'bed-cozy', 7, 3, NONE);
    expect(v).toMatchObject({ ok: false, reason: 'out-of-bounds' });
  });

  it('accepts the LAST floor row — 5+1 is not greater than rows=6', () => {
    // The obvious off-by-one in either direction is visible here.
    expect(canPlaceAt('bedroom', 'bed-cozy', 2, 5, NONE)).toEqual({ ok: true });
  });

  it('rejects a cell already occupied by another piece', () => {
    const placed = [{ slug: 'rug-round', copyIndex: 0, gridX: 2, gridY: 3 }];
    const v = canPlaceAt('bedroom', 'rug-round', 2, 3, placed);
    expect(v).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('ignores the copy being moved, but not a DIFFERENT copy of the same slug', () => {
    const placed = [
      { slug: 'rug-round', copyIndex: 0, gridX: 2, gridY: 3 },
      { slug: 'rug-round', copyIndex: 1, gridX: 4, gridY: 3 },
    ];
    // moving copy 0 onto its own cell is fine
    expect(canPlaceAt('bedroom', 'rug-round', 2, 3, placed, 0)).toEqual({ ok: true });
    // but copy 0 may not land on copy 1
    expect(canPlaceAt('bedroom', 'rug-round', 4, 3, placed, 0)).toMatchObject({
      ok: false,
      reason: 'occupied',
    });
  });

  it('rejects unknown room and unknown slug rather than throwing', () => {
    expect(canPlaceAt('nowhere', 'rug-round', 2, 3, NONE)).toMatchObject({ reason: 'unknown-room' });
    expect(canPlaceAt('bedroom', 'not-a-thing', 2, 3, NONE)).toMatchObject({ reason: 'unknown-slug' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

Run: `npx vitest run tests/unit/placement-rules.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/home/placement-rules"`.

- [ ] **Step 3: Write the module**

```ts
// src/lib/home/placement-rules.ts
/**
 * The pure half of placement validation — PURE and client-safe (no `@/db`).
 *
 * `placeFurnitureInTx` and the 3D room's green/red cells BOTH call this, so the
 * UI can never advertise a cell the server then rejects. Same rule as the 🔒
 * islands: when a surface shows what an action will accept, the showing and the
 * accepting must come from one function.
 *
 * The server still calls it inside its transaction and still owns ownership and
 * copy-index checks — sharing this is about agreement, not about trust.
 */
import { getRoom, cellZone } from '@/lib/home/rooms';
import { cellsForFootprint, cellKey } from '@/lib/home/grid';
import { getFurniture } from '@/lib/home/furniture-catalog';

export interface PlacedLite {
  slug: string;
  copyIndex: number;
  gridX: number;
  gridY: number;
}

export type PlacementVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: 'unknown-room' | 'unknown-slug' | 'out-of-bounds' | 'wrong-surface' | 'occupied';
      cell?: { x: number; y: number };
    };

export function canPlaceAt(
  roomId: string,
  slug: string,
  x: number,
  y: number,
  placements: PlacedLite[],
  /** The copy being MOVED, which must not block itself. */
  ignoreCopyIndex?: number,
): PlacementVerdict {
  const def = getFurniture(slug);
  if (!def) return { ok: false, reason: 'unknown-slug' };
  const room = getRoom(roomId);
  if (!room) return { ok: false, reason: 'unknown-room' };

  const fp = def.footprint;
  if (x < 0 || y < 0 || x + fp.w > room.cols || y + fp.h > room.rows) {
    return { ok: false, reason: 'out-of-bounds' };
  }

  const cells = cellsForFootprint(x, y, fp);
  for (const c of cells) {
    if (cellZone(room, c.x, c.y) !== def.surface) {
      return { ok: false, reason: 'wrong-surface', cell: c };
    }
  }

  // Skip ONLY the copy being moved — a second copy of the same slug still blocks.
  const occupied = new Set<string>();
  for (const p of placements) {
    if (p.slug === slug && p.copyIndex === ignoreCopyIndex) continue;
    const other = getFurniture(p.slug);
    if (!other) continue;
    for (const c of cellsForFootprint(p.gridX, p.gridY, other.footprint)) {
      occupied.add(cellKey(c.x, c.y));
    }
  }
  for (const c of cells) {
    if (occupied.has(cellKey(c.x, c.y))) {
      return { ok: false, reason: 'occupied', cell: c };
    }
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run the tests — all pass**

Run: `npx vitest run tests/unit/placement-rules.test.ts`

- [ ] **Step 5: Mutation-test each rule**

For EACH of the four rules (bounds, surface, occupied, ignore-copy), break it in the source, run the test, and confirm the failure names that rule. A test that passes against the broken code proves nothing — restore after each.

Example: change `y + fp.h > room.rows` to `y + fp.h > room.rows + 5`; the out-of-bounds test must fail.

- [ ] **Step 6: Commit**

```bash
git add src/lib/home/placement-rules.ts tests/unit/placement-rules.test.ts
git commit -m "feat(home): pure canPlaceAt, shared by server and 3D scene"
```

---

### Task 2: Server delegates to the shared validator

**Files:**
- Modify: `src/lib/db/home.ts` (steps 4–6 of `placeFurnitureInTx`, currently ~lines 129–181)
- Test: `tests/unit/placement-equivalence.test.ts`

**Interfaces:**
- Consumes: `canPlaceAt` from Task 1.
- Produces: no signature change. `placeFurnitureInTx` keeps throwing `InvalidPlacementError` / `CellOccupiedError`.

- [ ] **Step 1: Write the equivalence test first**

This is the test that matters — it is what stops the two drifting later.

```ts
// tests/unit/placement-equivalence.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/db', () => ({ db: {} }));
import { canPlaceAt } from '@/lib/home/placement-rules';

/**
 * The 3D room paints a cell green from `canPlaceAt`; the server accepts or
 * rejects it in `placeFurnitureInTx`. If those ever disagree the room promises
 * a drop the action bounces. This table is the contract.
 */
const CASES: { name: string; slug: string; x: number; y: number; ok: boolean }[] = [
  { name: 'floor item in floor zone', slug: 'rug-round', x: 2, y: 3, ok: true },
  { name: 'floor item in wall zone', slug: 'rug-round', x: 2, y: 0, ok: false },
  { name: 'off the right edge', slug: 'bed-cozy', x: 7, y: 3, ok: false },
  // y=5 with h=1 is 5+1=6, NOT > rows=6 — that cell is LEGAL. Verified against
  // the catalog rather than assumed; an off-by-one here would have had the
  // implementer debugging a correct implementation against a wrong expectation.
  { name: 'last floor row is legal', slug: 'bed-cozy', x: 2, y: 5, ok: true },
  { name: 'off the bottom edge', slug: 'bed-cozy', x: 2, y: 6, ok: false },
];

describe('canPlaceAt agrees with the server rules it was extracted from', () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(canPlaceAt('bedroom', c.slug, c.x, c.y, []).ok).toBe(c.ok);
    });
  }

  it('placeFurnitureInTx imports the shared validator rather than re-deriving', async () => {
    // A behavioural test cannot see this: a hand-rolled copy of the rules would
    // pass every case above and still drift the moment one side is edited.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/lib/db/home.ts', 'utf8'),
    );
    expect(src).toContain("from '@/lib/home/placement-rules'");
    expect(src).toContain('canPlaceAt(');
  });
});
```

- [ ] **Step 2: Run it — the import assertion must fail**

Run: `npx vitest run tests/unit/placement-equivalence.test.ts`
Expected: the last test FAILS (`home.ts` does not import the module yet). The four table cases already pass from Task 1.

- [ ] **Step 3: Replace steps 4–6 in `placeFurnitureInTx`**

Delete the in-bounds check, the surface-zone loop and the collision block (steps 4, 5, 6) and call the shared function. Keep steps 1–3 (slug, copy index, room) and step 7 (the upsert) exactly as they are.

```ts
  // 4-6. Bounds, surface zone and collision — shared verbatim with the 3D room
  // so the two can never disagree about which cells are legal.
  const existing = await tx
    .select({
      slug: homePlacements.furnitureSlug,
      copyIndex: homePlacements.copyIndex,
      gridX: homePlacements.gridX,
      gridY: homePlacements.gridY,
    })
    .from(homePlacements)
    .where(and(eq(homePlacements.childId, childId), eq(homePlacements.room, room)));

  const verdict = canPlaceAt(room, slug, x, y, existing, copyIndex);
  if (!verdict.ok) {
    if (verdict.reason === 'occupied') {
      throw new CellOccupiedError(room, verdict.cell!.x, verdict.cell!.y);
    }
    throw new InvalidPlacementError(
      `Cannot place "${slug}" at (${x},${y}) in "${room}": ${verdict.reason}`,
    );
  }
```

Add the import at the top: `import { canPlaceAt } from '@/lib/home/placement-rules';`

- [ ] **Step 4: Run the FULL suite**

Run: `npx vitest run`
Expected: all pass. `tests/unit/home-db.test.ts` (or whichever suite covers `placeFurnitureInTx`) must still pass unchanged — if a case now behaves differently, the extraction was not verbatim. Fix the extraction, not the test.

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(home): placeFurnitureInTx delegates cell rules to canPlaceAt"
```

---

### Task 3: worldToCell

**Files:**
- Create: `src/lib/home3d/coords.ts`
- Test: `tests/unit/home3d-coords.test.ts`

**Interfaces:**
- Consumes: the constants in `HomeRoom3D.tsx` — `COLS = 8`, `ROWS = 6`, `WALL_ROWS = 2`, `FLOOR_ROWS = 4`.
- Produces: `worldToCell(x, z, w, h) → { gridX, gridY }`.

**Note:** `cellToWorld` currently lives in `HomeRoom3D.tsx` with those constants module-private. Move `COLS`/`ROWS`/`WALL_ROWS`/`FLOOR_ROWS` **and** `cellToWorld` into `coords.ts`, and have `HomeRoom3D.tsx` re-export `cellToWorld` so its existing importers and tests keep working.

- [ ] **Step 1: Write the round-trip test**

```ts
// tests/unit/home3d-coords.test.ts
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
```

- [ ] **Step 2: Run it, watch it fail**

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `coords.ts`**

```ts
// src/lib/home3d/coords.ts
/** Grid ↔ world mapping for the 3D room. PURE — no three, no React. */

export const COLS = 8;
export const ROWS = 6;
export const WALL_ROWS = 2;
export const FLOOR_ROWS = ROWS - WALL_ROWS;

/** Grid cell → world centre of a w×h footprint anchored at (gridX, gridY). */
export function cellToWorld(gridX: number, gridY: number, w: number, h: number) {
  const x = gridX + w / 2 - COLS / 2;
  const zRow = gridY - WALL_ROWS;
  const z = zRow + h / 2 - FLOOR_ROWS / 2;
  return { x, z };
}

/**
 * World point → the grid cell a w×h footprint anchored there occupies.
 * Exact inverse of `cellToWorld`; a round-trip test pins every floor cell.
 */
export function worldToCell(x: number, z: number, w: number, h: number) {
  const gridX = Math.round(x - w / 2 + COLS / 2);
  const zRow = z - h / 2 + FLOOR_ROWS / 2;
  const gridY = Math.round(zRow + WALL_ROWS);
  return { gridX, gridY };
}
```

- [ ] **Step 4: Point `HomeRoom3D.tsx` at it**

Delete its local `COLS`/`ROWS`/`WALL_ROWS`/`FLOOR_ROWS` and its `cellToWorld` body; import them from `@/lib/home3d/coords` and re-export `cellToWorld` so existing importers and `tests/unit/home3d-grid.test.ts` are untouched:

```ts
import { COLS, ROWS, WALL_ROWS, FLOOR_ROWS, cellToWorld } from '@/lib/home3d/coords';
export { cellToWorld };
```

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all pass, `home3d-grid.test.ts` included.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(home3d): worldToCell, the inverse cellToWorld never had"
```

---

### Task 4: The buy-and-place action

**Files:**
- Modify: `src/lib/actions/home.ts`
- Test: `tests/unit/actions/buy-and-place.test.ts`

**Interfaces:**
- Consumes: `purchaseShopItemInTx` (`@/lib/db/shop`), `placeFurnitureInTx` (`@/lib/db/home`).
- Produces: `buyAndPlaceFurnitureAction(childId, room, slug, x, y, copyIndex, shopItemId | null) → BuyAndPlaceOutcome`, where
  `BuyAndPlaceOutcome = { status: 'placed' } | { status: 'insufficient'; required: number; available: number } | { status: 'occupied' } | { status: 'illegal'; reason: string } | { status: 'already_owned' }`.
  Passing `shopItemId: null` places a copy she already owns (no purchase).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/actions/buy-and-place.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const purchaseInTx = vi.fn();
const placeInTx = vi.fn();
const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));

vi.mock('@/db', () => ({ db: { transaction } }));
vi.mock('@/lib/db/shop', () => ({ purchaseShopItemInTx: purchaseInTx }));
vi.mock('@/lib/db/home', () => ({ placeFurnitureInTx: placeInTx }));
vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async () => ({ child: { id: 'c1' } })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { buyAndPlaceFurnitureAction } from '@/lib/actions/home';
import { InsufficientCoinsError } from '@/lib/errors/shop-errors';
import { CellOccupiedError } from '@/lib/errors/home-errors';

beforeEach(() => {
  purchaseInTx.mockReset().mockResolvedValue({ shopItemId: 's1', coinsAfter: 10 });
  placeInTx.mockReset().mockResolvedValue(undefined);
  transaction.mockClear();
});

describe('buyAndPlaceFurnitureAction', () => {
  it('purchases BEFORE placing — the ownership check reads the new row', async () => {
    const order: string[] = [];
    purchaseInTx.mockImplementation(async () => { order.push('buy'); return { shopItemId: 's1', coinsAfter: 10 }; });
    placeInTx.mockImplementation(async () => { order.push('place'); });

    await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 0, 's1');
    expect(order).toEqual(['buy', 'place']);
  });

  it('lets a placement failure reject the whole transaction, so the purchase rolls back', async () => {
    placeInTx.mockRejectedValue(new CellOccupiedError('bedroom', 2, 3));
    const out = await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 0, 's1');
    expect(out).toEqual({ status: 'occupied' });
    // The purchase ran, but inside the same transaction that then rejected —
    // asserting only the message would pass even if they were separate txs.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(purchaseInTx).toHaveBeenCalledTimes(1);
  });

  it('maps insufficient coins to an outcome rather than throwing', async () => {
    purchaseInTx.mockRejectedValue(new InsufficientCoinsError(680, 100));
    const out = await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 0, 's1');
    expect(out).toMatchObject({ status: 'insufficient' });
    expect(placeInTx).not.toHaveBeenCalled();
  });

  it('skips the purchase entirely when shopItemId is null (placing an owned copy)', async () => {
    const out = await buyAndPlaceFurnitureAction('c1', 'bedroom', 'rug-round', 2, 3, 1, null);
    expect(purchaseInTx).not.toHaveBeenCalled();
    expect(placeInTx).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ status: 'placed' });
  });
});
```

> **Verified while writing this plan:** `InsufficientCoinsError(required, available)` with `public readonly` fields of those names, in `src/lib/errors/shop-errors.ts`; `CellOccupiedError` / `InvalidPlacementError` / `FurnitureNotOwnedError` in `src/lib/errors/home-errors.ts`; `requireChild` from `@/lib/auth/guards`. The `err.required` / `err.available` reads in Task 4's implementation are correct as written.

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — `buyAndPlaceFurnitureAction` is not exported.

- [ ] **Step 3: Implement the action**

Append to `src/lib/actions/home.ts` (already `'use server'`, so the export must be async):

```ts
export type BuyAndPlaceOutcome =
  | { status: 'placed' }
  | { status: 'insufficient'; required: number; available: number }
  | { status: 'occupied' }
  | { status: 'illegal'; reason: string }
  | { status: 'already_owned' };

/**
 * Buy a piece and put it in the room as ONE transaction.
 *
 * Order is load-bearing: the purchase inserts the `shop_purchases` row that
 * `placeFurnitureInTx`'s ownership check then reads. Reversed, it always fails.
 *
 * Both helpers throw, which is what makes this composable — a rejected cell
 * rolls the purchase back by construction, so there is never a moment where she
 * has paid for a piece that is not in her room. The errors are mapped to an
 * outcome OUTSIDE `db.transaction(...)`: a catch inside the callback cannot stop
 * the transaction's own rejection escaping, and would defeat the rollback.
 *
 * `shopItemId === null` places a copy she already owns — no purchase at all.
 */
export async function buyAndPlaceFurnitureAction(
  childId: string,
  room: HomeRoomId,
  slug: string,
  x: number,
  y: number,
  copyIndex: number,
  shopItemId: string | null,
): Promise<BuyAndPlaceOutcome> {
  const { child } = await requireChild(childId);

  try {
    await db.transaction(async (tx) => {
      if (shopItemId) await purchaseShopItemInTx(tx, child.id, shopItemId);
      await placeFurnitureInTx(tx, child.id, room, slug, x, y, copyIndex);
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return { status: 'insufficient', required: err.required, available: err.available };
    }
    if (err instanceof AlreadyOwnedError) return { status: 'already_owned' };
    if (err instanceof CellOccupiedError) return { status: 'occupied' };
    if (err instanceof InvalidPlacementError || err instanceof FurnitureNotOwnedError) {
      return { status: 'illegal', reason: err.message };
    }
    throw err;
  }

  revalidatePath(`/play/${childId}/home`);
  return { status: 'placed' };
}
```

Match the property names on `InsufficientCoinsError` to the class; if it does not carry `required`/`available`, read them from the shop item and balance instead of inventing fields.

- [ ] **Step 4: Run the tests — all pass**

- [ ] **Step 5: Mutation-test the ordering guard**

Swap the two calls so placement runs first; the ordering test must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(home): buyAndPlaceFurnitureAction — one transaction, purchase first"
```

---

### Task 5: The ghost piece

**Files:**
- Create: `src/lib/home3d/ghost.ts` (pure) and `src/components/home3d/GhostPiece.tsx`
- Test: `tests/unit/home3d-ghost.test.tsx`

**Interfaces:**
- Consumes: `PIECES` from `@/lib/home3d/pieces`, `cellToWorld` from `@/lib/home3d/coords`.
- Produces: `<GhostPiece slug gridX gridY w h legal />`.

- [ ] **Step 1: Write the failing test**

jsdom has no WebGL, so assert the PROPS the ghost computes, not its pixels. Export the pure bit and test that:

```ts
// tests/unit/home3d-ghost.test.tsx
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
```

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Write the component**

First create the PURE module — it must NOT live in the component file:

```ts
// src/lib/home3d/ghost.ts   — PURE. No three, no drei, no React.
import { cellsForFootprint } from '@/lib/home/grid';

/** Green when the cell accepts the piece, red when it does not. */
export function ghostTint(legal: boolean): string {
  return legal ? '#4ade80' : '#f87171';
}

/** Which cells the footprint highlights. */
export function ghostTiles(gridX: number, gridY: number, w: number, h: number) {
  return cellsForFootprint(gridX, gridY, { w, h });
}
```

Then the component, which imports them:

```tsx
'use client';
import type { ReactElement } from 'react';
import { PIECES } from '@/lib/home3d/pieces';
import { cellToWorld } from '@/lib/home3d/coords';
import { ghostTint, ghostTiles } from '@/lib/home3d/ghost';

export function GhostPiece({
  slug, gridX, gridY, w, h, legal,
}: {
  slug: string; gridX: number; gridY: number; w: number; h: number; legal: boolean;
}): ReactElement | null {
  const Piece = PIECES[slug];
  if (!Piece) return null;               // unknown slug renders nothing, never a guess
  const { x, z } = cellToWorld(gridX, gridY, w, h);
  const tint = ghostTint(legal);

  return (
    <group>
      {/* footprint tiles just above the floor, so they read on any surface */}
      {ghostTiles(gridX, gridY, w, h).map((c) => {
        const p = cellToWorld(c.x, c.y, 1, 1);
        return (
          <mesh key={`${c.x},${c.y}`} position={[p.x, 0.02, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.96, 0.96]} />
            <meshBasicMaterial color={tint} transparent opacity={0.45} />
          </mesh>
        );
      })}
      {/* the piece itself, translucent */}
      <group position={[x, 0, z]}>
        <Piece />
      </group>
    </group>
  );
}
```

- [ ] **Step 4: Run tests, then commit**

```bash
git add -A && git commit -m "feat(home3d): translucent ghost piece with legal/illegal footprint tiles"
```

---

### Task 6: Make the scene pickable

**Files:**
- Modify: `src/components/home3d/HomeRoom3D.tsx`
- Create: `src/lib/home3d/pick.ts` (pure)
- Test: `tests/unit/home3d-pick.test.ts`

**Interfaces:**
- Consumes: `worldToCell`, `GhostPiece`.
- Produces: `HomeRoom3D` gains OPTIONAL `ghost?: {slug,w,h,gridX,gridY,legal}` and `onFloorPick?: (gridX, gridY) => void`. **Absent → today's view-only behaviour, unchanged.**

- [ ] **Step 1: The frameloop trap — read this before coding**

The Canvas is `frameloop="demand"`: it renders once and then stops. A ghost that moves will **not redraw**, with no error — it will simply appear frozen. Either:
- call `invalidate()` from `useThree()` whenever the ghost cell changes (preferred — keeps the battery win), or
- set `frameloop={ghost ? 'always' : 'demand'}`.

Take the first. Add a tiny `<Invalidator dep={...} />` child that calls `invalidate()` in a `useEffect` on the dep.

- [ ] **Step 2: Write the failing test — as a PURE test, not a render**

**Do not render the Canvas.** Nothing in this repo mocks `@react-three/fiber`,
jsdom has no WebGL, and `pieces.tsx` imports `RoundedBox` from drei — so an
import chain through a scene component drags the whole 3D stack into the test.
The existing `tests/unit/home3d-grid.test.ts` is pure, and that is the pattern
to follow.

Put the decision in a pure function and test THAT:

```ts
// src/lib/home3d/pick.ts  — PURE
import { worldToCell, WALL_ROWS } from '@/lib/home3d/coords';

/**
 * A floor-plane hit point → the cell a w×h footprint anchored there occupies,
 * clamped so a drag past the edge rests against it rather than vanishing.
 *
 * The FLOOR STARTS AT `WALL_ROWS`, not 0: `worldToCell` already folds the wall
 * rows into its `gridY`, so a lower bound of 0 lets a tall piece anchor inside
 * the wall. Two real catalog items are 2 cells tall (`yard-swing`, `yard-tree`),
 * so this is reachable, and it is silent — no error, and no test with h=1 can
 * see it.
 */
export function pickCell(
  point: { x: number; z: number },
  w: number, h: number,
  cols: number, rows: number,
) {
  const { gridX, gridY } = worldToCell(point.x, point.z, w, h);
  return {
    gridX: Math.min(Math.max(gridX, 0), cols - w),
    gridY: Math.min(Math.max(gridY, WALL_ROWS), rows - h),
  };
}
```

```ts
// tests/unit/home3d-pick.test.ts
import { describe, it, expect } from 'vitest';
import { pickCell } from '@/lib/home3d/pick';
import { cellToWorld } from '@/lib/home3d/coords';

describe('pickCell', () => {
  it('resolves a hit at a cell centre to that cell', () => {
    const p = cellToWorld(3, 4, 1, 1);
    expect(pickCell({ x: p.x, z: p.z }, 1, 1, 8, 6)).toEqual({ gridX: 3, gridY: 4 });
  });

  it('clamps a drag past the right edge to the last legal anchor', () => {
    // a 2-wide piece can anchor at most at x = cols - w = 6
    expect(pickCell({ x: 99, z: 0 }, 2, 1, 8, 6).gridX).toBe(6);
  });

  it('clamps a drag past the top edge to the first FLOOR row, not row 0', () => {
    expect(pickCell({ x: -99, z: -99 }, 1, 1, 8, 6)).toEqual({ gridX: 0, gridY: WALL_ROWS });
  });

  it('never resolves a 2-tall piece into the wall zone', () => {
    expect(pickCell({ x: 0, z: -99 }, 2, 2, 8, 6).gridY).toBe(WALL_ROWS);
  });
});
```

- [ ] **Step 3: Implement, keeping view-only the default**

Guard every new behaviour on the prop being present, so `Room3DPanel`'s current read-only usage is byte-for-byte unchanged.

- [ ] **Step 4: Run the full suite, then commit**

---

### Task 7: The edit flow in `Room3DPanel`

**Files:**
- Modify: `src/components/home3d/Room3DPanel.tsx`
- Test: `tests/unit/room3d-panel-edit.test.tsx`

- [ ] **Step 1: State model**

```
selected: { slug, w, h, shopItemId | null, copyIndex } | null   — what is being placed
ghostCell: { gridX, gridY } | null                              — where it hovers
legal = selected && ghostCell ? canPlaceAt(room, slug, gx, gy, placed, copyIndex).ok : false
```

Confirm bar shows:
- owned copy → `放这里 / Place here`
- purchase → `🪙<price>  买下并放这里 / Buy & place here`
- illegal cell or not affordable → disabled + a quiet grey chip, **never a scolding sentence** (the shop's `tooExpensive` rule)

- [ ] **Step 2: Write tests for the confirm-bar decision — pure, not rendered**

`Room3DPanel` mounts a Canvas, so it cannot be rendered in jsdom (see Task 6).
Put the decision in a pure function and test that:

```ts
// src/lib/home3d/confirm-bar.ts — PURE
export type ConfirmState =
  | { kind: 'place' }                              // owned copy, legal cell
  | { kind: 'buy'; priceCoins: number }            // legal cell, affordable
  | { kind: 'disabled'; why: 'illegal' | 'poor' };

export function confirmState(args: {
  legal: boolean; owned: boolean; priceCoins: number; coins: number;
}): ConfirmState {
  if (!args.legal) return { kind: 'disabled', why: 'illegal' };
  if (args.owned) return { kind: 'place' };
  if (args.coins < args.priceCoins) return { kind: 'disabled', why: 'poor' };
  return { kind: 'buy', priceCoins: args.priceCoins };
}
```

Test every branch, including that an illegal cell wins over affordability (she
should not be told she is poor when the real problem is where she is pointing).

The bilingual labels are asserted in whatever component test the implementer can
write WITHOUT mounting the Canvas — if none is possible, assert the label
constants from a pure module instead. Both labels must appear: `放这里 / Place
here` and `买下并放这里 / Buy & place here`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: `touch-action: none` on the canvas while a ghost is active**

Otherwise dragging the ghost scrolls the page on her iPad. Only while active — the read-only view must stay scrollable.

- [ ] **Step 5: Full suite + commit**

---

### Task 8: Wire the shop entry point

**Files:**
- Modify: `src/components/shop/HomeTabBody.tsx`, `src/components/home3d/HomeViewSwitch.tsx`

- [ ] **Step 1:** Tapping a furniture tile with the 3D view available selects it and switches to the 3D room with the ghost active, instead of buying immediately.
- [ ] **Step 2:** When 3D is unavailable (no WebGL) the tile keeps today's buy-then-place-in-2D behaviour. **Verify by forcing the fallback**, not by reasoning about it.
- [ ] **Step 3:** Full suite + `pnpm build` + commit.

---

### Task 9: Docs

- [ ] Update `CLAUDE.md`: the Home (家) snapshot, plus a landmine for the `frameloop="demand"` trap and one for the shared-validator contract.
- [ ] `docs/CHANGELOG.md` entry; `PLAN.md` §1 row.
- [ ] Heading-diff `CLAUDE.md` before/after (the scripted-edit landmine).

---

## Self-review

**Spec coverage:** flow → Tasks 5-8. Shared validator → Tasks 1-2. Transaction → Task 4. Raycast → Tasks 3, 6. Failure modes → Tasks 4, 7, 8. Out-of-scope items appear nowhere.

**Placeholders:** Tasks 6 and 7 leave render-call bodies to be filled from existing sibling tests rather than inventing a mock shape for `@react-three/fiber` that may not match; the pattern to copy is named. Everything else carries real code.

**Type consistency:** `PlacedLite` (Task 1) is the shape `canPlaceAt` takes in both callers; `placeFurnitureInTx`'s select in Task 2 is aliased to those exact field names (`gridX`/`gridY`, not `x`/`y`) so the two agree.

**Verified against the source while writing, not assumed:** `InsufficientCoinsError(required, available)`; the three home error classes' module; `requireChild`'s import path; `rug-round` = floor/1×1 and `bed-cozy` = floor/2×1; grid 8×6 with `wallRows = 2`.

**One assertion in the first draft was wrong** and is worth naming, because it is the failure mode this plan is most exposed to: it claimed `bed-cozy` at `y=5` was out of bounds. `5 + 1 = 6` is not greater than `rows = 6`, so that cell is legal — an implementer would have debugged a correct implementation against a wrong expectation. Every bounds case was then recomputed against the real rule. **Still to read before coding (not guessed here):** the existing `@react-three/fiber` `Canvas` mock shape in `tests/unit/home3d-*.test.tsx`, which Tasks 6-7 copy rather than invent.
