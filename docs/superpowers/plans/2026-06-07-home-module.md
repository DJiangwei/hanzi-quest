# 家 / Home Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A decoratable 3-room home (🏠 nav tab) where the kid buys flat-SVG furniture in a new shop category and arranges it on a grid via tap-to-place, persisted per child.

**Architecture:** Code-defined rooms + furniture catalog (flat SVG); `home_placements` table for placed items; owned furniture derives from `shop_purchases` (kind `home`); server-authoritative placement actions; a tap-to-place client view. Phased: data+catalog → render+placement → shop+nav → docs.

**Tech Stack:** Next.js 16, Drizzle (append-only migration), React 19, Tailwind, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-07-home-module-design.md`
**Branch:** `feat/home-module` (spec committed).

---

## Verified shapes

- `shopItems.kind` is the **`shop_item_kind` pgEnum** (`src/db/schema/shop.ts`) → adding `'home'` needs `ALTER TYPE shop_item_kind ADD VALUE 'home'` in the migration (additive; proven pattern — coin_reason). The kind column already exists.
- `purchaseShopItemInTx` (`src/lib/db/shop.ts:175`) `switch (shopItem.kind)`: generic group `case 'sound_theme': case 'pet': case 'decor': return purchaseGenericInTx(...)` (coin debit + `shop_purchases` row; ownership = a `shop_purchases` row). **Add `case 'home':` to that group.**
- `ShopCategory = 'avatar'|'sound'|'pet'|'decor'|'powerup'` + `TABS` (`ShopCategoryTabs.tsx`) + `ShopBody.tsx` tab switch. Tab-id→kind map: avatar→avatar, sound→sound_theme, pet→pet, decor→decor, powerup→powerup; **home→home**.
- `KidNavBar.tsx` `tabs: TabDef[]` (key/href/icon/label/isActive). Add a 🏠 home tab.
- Reuse the seed pattern of `scripts/seed-decorations.ts`; pure errors in `src/lib/errors/`.

---

## PHASE 1 — Data + catalog

### Task 1: Migration + schema

**Files:** Create `src/db/schema/home.ts`; Modify `src/db/schema/index.ts` (barrel) + `src/db/schema/shop.ts` (add `'home'` to `shopItemKind`); generated `drizzle/00XX_*.sql`.

- [ ] **Step 1: Schema.** `src/db/schema/home.ts`:

```ts
import { integer, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const homePlacements = pgTable('home_placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  room: text('room').notNull(),               // 'bedroom' | 'living' | 'playroom'
  furnitureSlug: text('furniture_slug').notNull(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('home_placements_child_furniture_uq').on(t.childId, t.furnitureSlug)]);
```

- [ ] **Step 2: Enum + barrel.** In `src/db/schema/shop.ts`, append `'home'` to the `shopItemKind = pgEnum('shop_item_kind', [...])` values (keep existing order). Export `home` schema from `src/db/schema/index.ts`.

- [ ] **Step 3: Generate.** `pnpm drizzle-kit generate` → new `00XX_*.sql` with `CREATE TABLE home_placements` + `ALTER TYPE shop_item_kind ADD VALUE 'home'`. Verify `git status --short drizzle/` shows only new files + journal; no edits to prior migrations. `pnpm typecheck` clean.

- [ ] **Step 4: Commit.** `git commit -m "feat(home): home_placements table + 'home' shop kind"`.

### Task 2: Rooms (`src/lib/home/rooms.tsx`)

**Files:** Create `src/lib/home/rooms.tsx`; Test `tests/unit/home/rooms.test.tsx`.

- [ ] **Step 1: Failing test.** Assert `HOME_ROOMS` has 3 entries (`bedroom/living/playroom`) each with `nameZh/nameEn`, `cols===8`, `rows===6`, `wallRows===2`; `cellZone(roomDims, x, y)` returns `'wall'` for y<2 else `'floor'`; each `Backdrop` renders.

- [ ] **Step 2/3: Implement.** Pure-ish module (client-safe SVG):

```ts
export type HomeRoomId = 'bedroom' | 'living' | 'playroom';
export interface RoomDef {
  id: HomeRoomId; nameZh: string; nameEn: string;
  cols: number; rows: number; wallRows: number; // top wallRows are 'wall' zone
  Backdrop: () => ReactElement;                  // flat-SVG wall+floor, 100×75 viewBox (8:6)
}
export const HOME_ROOMS: RoomDef[] = [ /* bedroom, living, playroom */ ];
export function getRoom(id: string): RoomDef | undefined { ... }
export function cellZone(room: RoomDef, _x: number, y: number): 'wall' | 'floor' {
  return y < room.wallRows ? 'wall' : 'floor';
}
```
Each `Backdrop` = a flat-SVG room (wall color top, floor color bottom, simple baseboard/skirting line), distinct palette per room (bedroom = warm, living = cool, playroom = bright). 8×6 grid → use a `100 × 75` viewBox (each cell 12.5 wide). Art is implementer craft; structure (cols/rows/wallRows/zone) is the contract.

- [ ] **Step 4: Commit** (`feat(home): 3 room defs + backdrops + grid zones`).

### Task 3: Furniture catalog (`src/lib/home/furniture-catalog.tsx`)

**Files:** Create `src/lib/home/furniture-catalog.tsx`; Test `tests/unit/home/furniture-catalog.test.ts`.

- [ ] **Step 1: Failing test.** Assert ~18–20 defs; each has `slug/category/surface∈{wall,floor}/footprint{w,h}/nameZh/nameEn/rarity/priceCoins` + `Component`; slugs unique; every `surface` valid; render-smoke (`def.Component()` truthy); at least one item per category.

- [ ] **Step 2/3: Implement.**

```ts
export type FurnitureCategory = 'wall_art' | 'window_light' | 'furniture' | 'rug' | 'plant_toy';
export type Surface = 'wall' | 'floor';
export interface FurnitureDef {
  slug: string; category: FurnitureCategory; surface: Surface;
  footprint: { w: number; h: number };
  nameZh: string; nameEn: string; rarity: 'common'|'rare'|'epic'; priceCoins: number;
  Component: () => ReactElement; // flat-SVG <g> sized to footprint cell-box
}
export const FURNITURE_CATALOG: FurnitureDef[] = [ /* the ~18-20 items below */ ];
export const FURNITURE_BY_SLUG = new Map(FURNITURE_CATALOG.map((f) => [f.slug, f]));
export function getFurniture(slug: string) { return FURNITURE_BY_SLUG.get(slug); }
```

Items (slug · category · surface · footprint · ¢): `poster-stars`(wall_art·wall·1×1·90) · `framed-fish`(wall_art·wall·1×1·110) · `clock-round`(wall_art·wall·1×1·120) · `window-sunny`(window_light·wall·2×1·160) · `lamp-string`(window_light·wall·1×1·130) · `bed-cozy`(furniture·floor·2×1·300·rare) · `sofa-teal`(furniture·floor·2×1·320·rare) · `chair-wood`(furniture·floor·1×1·120) · `table-round`(furniture·floor·1×1·140) · `bookshelf`(furniture·floor·2×1·300·rare) · `toy-chest`(furniture·floor·1×1·150) · `desk-study`(furniture·floor·2×1·280·rare) · `rug-round`(rug·floor·1×1·100) · `rug-stripe`(rug·floor·2×1·140) · `plant-fern`(plant_toy·floor·1×1·90) · `plant-cactus`(plant_toy·floor·1×1·90) · `teddy-bear`(plant_toy·floor·1×1·110) · `ball-beach`(plant_toy·floor·1×1·80) · `rocket-lamp`(plant_toy·floor·1×1·150·rare) · `floor-lamp`(window_light·floor·1×1·130). (Tunable; ~20 items, all 5 categories, every category covered.) Each `Component` = a flat-SVG `<g>` drawn within a `12.5 × 12.5`-per-cell box (×footprint), copying the avatar/decor SVG conventions.

- [ ] **Step 4: Commit** (`feat(home): ~20 flat-SVG furniture items + catalog`).

### Task 4: Home DB layer (`src/lib/db/home.ts`) + errors

**Files:** Create `src/lib/db/home.ts`, `src/lib/errors/home-errors.ts`; Test `tests/unit/home/home-db.test.ts`.

- [ ] **Step 1: Errors (pure, client-safe).** `home-errors.ts`: `FurnitureNotOwnedError`, `CellOccupiedError`, `InvalidPlacementError` (out-of-bounds / wrong-surface). Plain `Error` subclasses (no `@/db` import).

- [ ] **Step 2: Failing test.** Mock `@/db`. Assert `getHomeState` returns `{ ownedSlugs, placements }`; `placeFurnitureInTx` rejects unowned (FurnitureNotOwnedError), out-of-bounds/wrong-surface (InvalidPlacementError), and collision (CellOccupiedError); upserts a valid placement (move = update by the unique key); `removeFurnitureInTx` deletes.

- [ ] **Step 3: Implement.** `src/lib/db/home.ts` (server-only):
  - `getOwnedFurnitureSlugs(childId)` → join `shop_purchases × shop_items WHERE kind='home'` → slugs.
  - `getHomeState(childId)` → `{ ownedSlugs, placements: {room, slug, x, y}[] }`.
  - `placeFurnitureInTx(tx, childId, room, slug, x, y)`:
    1. `getFurniture(slug)` must exist; child must own it (else FurnitureNotOwnedError).
    2. Validate against the room: `getRoom(room)`; the footprint cells must be in-bounds and every cell's `cellZone` must equal the item's `surface` (else InvalidPlacementError).
    3. Collision: no OTHER placement in the same room occupies any of the footprint cells (compute occupied cells from existing placements + their footprints; else CellOccupiedError).
    4. Upsert `home_placements` on the `(childId, furnitureSlug)` unique key (move overwrites room/x/y).
  - `removeFurnitureInTx(tx, childId, slug)` → delete the placement.

- [ ] **Step 4: Commit** (`feat(home): home db layer + placement validation`).

---

## PHASE 2 — Actions + room render + placement

### Task 5: Server actions (`src/lib/actions/home.ts`)

**Files:** Create `src/lib/actions/home.ts`; Test `tests/unit/home/home-actions.test.ts`.

- [ ] **Step 1: Failing test.** Mock `@/db`, `requireChild`, `next/cache`. Assert `placeFurnitureAction` calls `requireChild`, runs `placeFurnitureInTx` in a tx, `revalidatePath('/play/${childId}/home')`, returns `{ok:true}` or `{ok:false, reason}`; `removeFurnitureAction` similar.

- [ ] **Step 2/3: Implement** (`'use server'`, async exports only):
  - `placeFurnitureAction(childId, room, slug, x, y)` → `requireChild` → `db.transaction(placeFurnitureInTx)`; catch the home errors → `{ok:false, reason}`; on success revalidate → `{ok:true}`.
  - `removeFurnitureAction(childId, slug)` → similar.

- [ ] **Step 4: Commit** (`feat(home): place/remove furniture server actions`).

### Task 6: `HomeRoomView` + placement UI

**Files:** Create `src/components/home/{HomeRoomView,RoomTabs,RoomCanvas,FurnitureTray,PlacedFurniture}.tsx`; Test `tests/unit/home/home-room-view.test.tsx`.

- [ ] **Step 1: Failing test.** Render `HomeRoomView` with a stub `{ ownedSlugs, placements }` + childId. Assert: view mode renders placed furniture (testid `placed-furniture` per item) for the active room; the ✏️ toggle enters edit mode showing the grid (`room-grid`) + a tray (`furniture-tray`) of owned-unplaced items; tapping a tray item then a valid cell calls `placeFurnitureAction` (mock it); room tabs switch the active room.

- [ ] **Step 2/3: Implement.** `HomeRoomView` (`'use client'`) state machine:
  - State: `activeRoom: HomeRoomId`, `mode: 'view'|'edit'`, `selected: { source:'tray'|'placed', slug } | null`.
  - **RoomTabs**: 3 buttons → `setActiveRoom`.
  - **RoomCanvas**: renders `getRoom(activeRoom).Backdrop()` (via an `<svg viewBox="0 0 100 75">`), then the room's placements as `<PlacedFurniture>` at cell coords (`x*12.5, y*12.5`, size = footprint×12.5). In edit mode overlays a faint grid (lines per cell). When `selected` is set, **valid cells highlight** (compute client-side: matching surface + collision-free), and a tap on a valid cell fires `placeFurnitureAction(childId, activeRoom, selected.slug, x, y)` then clears `selected` (optimistic: update local placements; the server revalidate confirms).
  - Tapping a **placed** item in edit mode sets `selected={source:'placed', slug}` (lift) and shows a "↩︎ 收起 / Put away" button → `removeFurnitureAction`.
  - **FurnitureTray** (edit mode): owned slugs not currently placed (in ANY room) → tappable chips rendering the furniture `Component` + name; tap → `selected={source:'tray', slug}`.
  - Reduced-motion safe; all tap targets ≥44px. No literal drag — pure tap-to-place.
  - Optimistic local state for snappy feel; reconcile from props on navigation.

  Keep each subcomponent focused (`RoomCanvas` = render + cell math; `FurnitureTray` = chip list; `PlacedFurniture` = one item; `RoomTabs` = switcher). Cell math helper `cellsForFootprint(x,y,fp)` + `validCells(room, fp, surface, occupied)` can live in `src/lib/home/grid.ts` (pure, tested in Task 6 or its own mini-test).

- [ ] **Step 4: Commit** (`feat(home): HomeRoomView tap-to-place room editor`).

### Task 7: `/home` route

**Files:** Create `src/app/play/[childId]/home/page.tsx`; Test thin/typecheck.

- [ ] **Step 1: Implement.** Server component: `requireChild` (match the existing play-page auth pattern), `const { ownedSlugs, placements } = await getHomeState(child.id)`, render the play chrome + `<HomeRoomView childId ownedSlugs placements />`. Empty state when `ownedSlugs` is empty: a friendly "去商店买家具吧 / Buy furniture in the shop" with a link to `/play/[childId]/shop`.

- [ ] **Step 2: Verify.** `pnpm typecheck && lint && build` green.

- [ ] **Step 3: Commit** (`feat(home): /home route`).

---

## PHASE 3 — Shop category + nav

### Task 8: Shop 'home' category + purchase dispatch + seed

**Files:** Modify `src/components/shop/ShopCategoryTabs.tsx`, `src/app/play/[childId]/shop/ShopBody.tsx`, `src/lib/db/shop.ts`; Create `src/components/shop/HomeTabBody.tsx`, `scripts/seed-home-furniture.ts`; Tests.

- [ ] **Step 1: Purchase dispatch (TDD).** In `src/lib/db/shop.ts`, add `case 'home':` to the generic group (`case 'sound_theme': case 'pet': case 'decor': case 'home': return purchaseGenericInTx(...)`). Extend the ownership comment. Add/extend a `shop-db` test asserting a `home`-kind purchase debits coins + writes a `shop_purchases` row.

- [ ] **Step 2: ShopCategory + tab.** Add `'home'` to `ShopCategory` + a `{ id:'home', emoji:'🏠', label:'家具', disabled:false }` `TABS` entry. In `ShopBody.tsx`, add `{activeTab === 'home' && <HomeTabBody childId={childId} owned={...} balance={...} />}` (mirror the decor tab body's props).

- [ ] **Step 3: `HomeTabBody`.** Lists `FURNITURE_CATALOG` grouped by `category`, each item a card (render `Component` preview + name + price + owned/affordable state) → `PurchaseConfirmDialog` → `purchaseShopItemAction(childId, shopItemId)` (the existing action; the new `home` kind flows through the dispatch). Owned furniture shows "已购买". Follow `DecorTabBody`'s structure.

- [ ] **Step 4: Seed script.** `scripts/seed-home-furniture.ts` (`loadEnv()` + dynamic db import per the CLAUDE.md rule; mirror `seed-decorations.ts`): upsert a `shop_items` row per `FURNITURE_CATALOG` entry (kind `'home'`, slug = furniture slug, name = nameZh, priceCoins, metadata `{ rarity, category }`), idempotent on slug.

- [ ] **Step 5: Tests + commit.** Test `HomeTabBody` renders grouped items + buy flow; run avatar/shop tests. Commit (`feat(home): 家具 shop category + purchase dispatch + seed`).

### Task 9: 🏠 nav tab

**Files:** Modify `src/components/play/KidNavBar.tsx`; Test.

- [ ] **Step 1: Add the tab** to the `tabs` array (after `backpack` or before `shop` — implementer's eye for layout): `{ key:'home', href:\`/play/${childId}/home\`, icon:'🏠', label:'家', isActive:(p)=>p.startsWith(\`/play/${childId}/home\`) }`. Update the nav test to assert 5 tabs incl. 🏠.

- [ ] **Step 2: Verify + commit.** `pnpm typecheck && lint && test` green. Commit (`feat(home): 🏠 home nav tab`).

---

## PHASE 4 — Docs + gate + PR

### Task 10: Docs + four-green gate + PR (+ optional styling checkpoint)

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: (Optional) styling checkpoint.** If desired, run the four-green gate + `pnpm dev`, give David the local URL (`/play/<childId>/home`) to eyeball the room/furniture look before finalizing; tune SVGs. (Subagent dispatch may be limited — controller can run dev inline.)
- [ ] **Step 2: CLAUDE.md.** Entry: 家/Home module (3 rooms, tap-to-place grid, 🏠 nav + 🏠家具 shop, `home_placements` + `'home'` kind). Landmines: *home furniture owned derives from `shop_purchases` (kind `home`), placements in `home_placements` (unique per child+slug = own-1-place-1); rooms + furniture catalog + grid are code-only; distinct from the island `decor` system.* Note the **post-merge seed**. Update refresh date.
- [ ] **Step 3: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → green.
- [ ] **Step 4: Commit, push, PR.** `gh pr create --title "feat(home): 家/Home module — decoratable 3-room home"`. PR body: the feature + **post-merge:** `pnpm tsx scripts/seed-home-furniture.ts` against prod. Migration 00XX auto-applies on deploy.

---

## Self-review notes (addressed)

- **Spec coverage:** schema → T1; rooms → T2; furniture → T3; db+validation → T4; actions → T5; placement UI → T6; route → T7; shop+dispatch+seed → T8; nav → T9; docs → T10. ✓
- **Type consistency:** `HOME_ROOMS`/`RoomDef`/`cellZone` (T2) used by db (T4) + UI (T6); `FurnitureDef`/`getFurniture` (T3) used in T4/T6/T8; `home_placements` unique `(childId,slug)` (T1) matches the upsert (T4) + own-1-place-1 model; `'home'` shop kind threads enum (T1) → dispatch (T8) → seed (T8). Grid cell = 12.5 units (100/8) consistently. ✓
- **Append-only migration:** T1 generates one migration (table + enum value); guarded by the additive-only check. `ALTER TYPE ADD VALUE` proven (coin_reason). ✓
- **No regression:** island `decor` system untouched; shop generic dispatch extended (not forked); existing shop tests get the new kind. ✓
- **`'use server'`:** `actions/home.ts` async-only; pure logic in `lib/home/*` + `lib/db/home.ts`; errors in `lib/errors`. ✓
