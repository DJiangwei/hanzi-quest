# 3D home — buy and place as one flow

**Status:** design, awaiting David's review.
**Ask:** *"关于家的3D视角部分，能否把购买和edit功能全部都3D化？"* (2026-09-08)

---

## What this is

Today the 3D home is a **view**. Editing happens in the 2D grid (tap tray, tap
cell) and buying happens in a 2D shop grid; the two are separate errands, and
neither is where the child is actually looking at her room.

This makes them one act: **pick a piece → it appears as a ghost in the 3D room →
put it down → one confirm buys it and places it.** Placing something she already
owns is the same gesture minus the price.

Chosen over two lesser versions (a 3D preview pane beside the existing shop; 3D
editing only) because buying and placing are one intention for a six-year-old
decorating a room, and splitting them is an adult's idea of an inventory system.

## What it is NOT

- **Not a replacement for the 2D room.** It stays, and stays editable. WebGL can
  fail on her iPad, and a decorated home must remain visible and changeable
  rather than gone — the reason `Room3DPanel` was additive in the first place.
- **Not 3D thumbnails on shop cards.** Each `<Canvas>` holds a WebGL context;
  browsers cap around 8–16 and **silently discard the oldest** past that. 35
  furniture + 19 surfaces ≈ 54 tiles would blank cards at random, worst on the
  device this is for. The shop grid keeps its flat SVG thumbnails — PR #189 just
  made that grid usable by a six-year-old, and this design spends its one WebGL
  context where the decision actually happens: **in the room**.
- **No rotation.** Placements have no rotation column today and footprints are
  axis-aligned. Adding it is a separate change.
- **No camera control.** The camera stays locked, which is what makes the
  raycast tractable at all (see below).

---

## The flow

```
商店 (existing grid, SVG thumbnails)
  │  tap a piece
  ▼
3D room — the piece is now a translucent GHOST
  │  drag: ghost follows the finger, snapping to cells
  │  cells under it: green = legal, red = illegal
  │  release: ghost stays put
  ▼
confirm bar:  [ 🪙680  买下并放这里 / Buy & place here ]
  │            (owned already → 放这里 / Place here, no price)
  ▼
one server action → one transaction → coins debited AND piece placed
```

Illegal cells never accept a drop: the confirm bar stays disabled with a quiet
chip, never a scolding sentence (the shop's `tooExpensive` rule, same reasoning).

## Architecture

### 1. One validator, two callers — the crux

`placeFurnitureInTx` validates in 7 steps. Steps 3–6 (room exists, in bounds,
surface zone matches, no collision) are **pure** given the room def, the
footprint and the existing placements. They are extracted verbatim into

```
src/lib/home/placement-rules.ts   (pure, client-safe, no @/db)
  canPlaceAt(room, slug, x, y, placements, ignoreCopy?) → PlacementVerdict
```

`placeFurnitureInTx` then calls it and throws its existing typed errors; the 3D
scene calls the same function to paint cells green or red. **The server keeps
validating independently** — the shared function is about the two never
*disagreeing*, not about trusting the client.

This is the 🔒-island lesson applied to a new surface: when a UI advertises what
an action will accept, the advertisement and the acceptance must come from one
function, or the board promises what the route bounces.

### 2. Buy and place in ONE transaction

```ts
// inside the action, after requireChild
try {
  await db.transaction(async (tx) => {
    await purchaseShopItemInTx(tx, childId, shopItemId);           // throws on
    await placeFurnitureInTx(tx, childId, room, slug, x, y, copy); // either half
  });
  return { status: 'placed' };
} catch (e) {                       // OUTSIDE the transaction — see below
  if (e instanceof InsufficientCoinsError) return { status: 'insufficient', … };
  if (e instanceof CellOccupiedError)      return { status: 'occupied', … };
  if (e instanceof InvalidPlacementError)  return { status: 'illegal', … };
  throw e;
}
```

**Order is load-bearing:** the purchase inserts the `shop_purchases` row that
`placeFurnitureInTx`'s step-2 ownership check then reads. Reversed, it always
fails.

**Failure rolls back both.** A cell that turned out to be occupied refunds the
coins by construction rather than by compensation — there is no window in which
she has paid for a piece that is not in her room.

**Both halves already throw, which is what makes this composable.**
`purchaseShopItemInTx` throws `InsufficientCoinsError` / `AlreadyOwnedError` and
returns a plain `PurchaseResult`; the discriminated `PurchaseOutcome` lives one
layer up, in `purchaseShopItemAction`, which catches those throws. So the new
action follows the established shape exactly: let both `*InTx` helpers throw so
the transaction rolls back, and map the error to an outcome **outside**
`db.transaction(...)`. Catching inside the callback cannot stop the
transaction's own rejection escaping (the documented in-transaction landmine),
and would defeat the rollback this design depends on.

The action returns a discriminated `BuyAndPlaceOutcome` mirroring
`PurchaseOutcome`'s style — never a thrown error for an expected case, so the
confirm bar can render a quiet chip instead of an error boundary.

> An earlier draft of this spec had `purchaseShopItemInTx` returning a
> discriminated outcome and wrapped it in a `PurchaseAborted` throw to force the
> rollback. That type does not exist at this layer; checking the real signature
> made the design simpler rather than more complex.

### 3. Raycast — why it is safe now

`Room3DPanel`'s docstring called rebuilding the editor in 3D "the riskiest part
of the module" because it means raycasting a moving grid. **The camera is locked**
(David's choice when the 3D work started), so the projection is fixed and the
ray only ever meets one axis-aligned floor plane at a known height.

`cellToWorld(gridX, gridY, w, h)` already exists in `HomeRoom3D`. This adds its
inverse, `worldToCell(x, z)`, and a round-trip test pins them against each other
for every cell of every room — a drift between them would put the ghost one cell
away from where the piece lands, which is the single most confusing bug this
feature could have.

### 4. Components

| file | role |
|---|---|
| `src/lib/home/placement-rules.ts` | **new** — pure `canPlaceAt`, shared by server + scene |
| `src/lib/home3d/coords.ts` | **new** — `worldToCell`, inverse of the existing `cellToWorld` |
| `HomeRoom3D.tsx` | gains an optional `ghost` + `onCellPick`; view-only when absent |
| `Room3DPanel.tsx` | owns edit state (selected piece, ghost cell, confirm bar) |
| `src/lib/actions/home.ts` | **new** `buyAndPlaceFurnitureAction` (`requireChild` first) |
| `src/lib/db/home.ts` | `placeFurnitureInTx` delegates steps 3–6 to `canPlaceAt` |

## Failure modes

| case | behaviour |
|---|---|
| WebGL unavailable | 3D panel does not mount; 2D room keeps its editor. Nothing is unreachable. |
| not enough coins | confirm bar shows a quiet grey chip, tap disabled. Never "you can't afford this". |
| cell occupied / wrong zone | ghost is red, confirm disabled. No drop, no toast. |
| copy cap reached (3) | piece is not offered as a ghost; the shop tile already shows 满. |
| race — coins spent elsewhere mid-drag | server rejects, whole transaction rolls back, one bilingual toast. |

## Testing

- `canPlaceAt` unit tests: bounds, surface zone, collision, and the
  ignore-the-copy-being-moved case. Each mutation-tested by breaking the rule and
  watching the named assertion fail.
- **The equivalence test that matters:** a table of placements asserted to give
  the same verdict from `canPlaceAt` as `placeFurnitureInTx` accepts/rejects, so
  the two can never drift.
- `worldToCell(cellToWorld(c)) === c` for every cell of every room.
- Action tests: purchase-then-place ordering; a placement failure leaves **no**
  `shop_purchases` row (the rollback is the point, and a test that only checks
  the error message would pass without it).
- 3D interaction is not asserted through rendering — jsdom has no WebGL. The
  scene is tested through its props (the props-capturing mock pattern), and the
  pure modules carry the real coverage.

## Risks

1. **Touch drag on a 3D canvas competing with page scroll.** Mitigated by
   `touch-action: none` on the canvas while a ghost is active, and by the fact
   that the confirm is a separate tap — a mis-drag costs nothing.
2. **The equivalence between `canPlaceAt` and the server drifting later.** The
   equivalence test is the guard; the extraction is verbatim, not a rewrite.
3. **Scope creep into rotation / free placement.** Explicitly out.

## Out of scope

Rotation, camera control, 3D shop thumbnails, moving *surfaces* (wallpaper and
floor stay in the 2D shop), and the island-decoration tab, which is a different
subsystem despite the similar name.
