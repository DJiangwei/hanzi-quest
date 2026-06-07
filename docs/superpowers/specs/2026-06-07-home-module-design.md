# 家 / Home Module — Design Spec

**Date:** 2026-06-07
**Status:** approved (design)
**Context:** David wants a new **「家」/ Home** module — a decoratable home the kid furnishes with items bought in the shop. Reference research (Webkinz/Club-Penguin igloo, Animal Crossing, Toca Boca, Reading Eggs) informed the model. David's choices: **flat-cartoon SVG** art (consistent with the app, buildable now), **grid-snap placement** via **tap-to-place** (reliable for a 6yo's fingers), and **multiple rooms** (3 in v1). Distinct from the existing 🏝️ island-decoration system (PR #34), which stays as-is.

First of three asks; the others (Backpack expansion: flags-by-continent + Solar-System grouping) and a paused Story-Mode redesign are separate.

---

## 1. North Star

> Yinuo taps the 🏠 home tab, sees her cozy bedroom / living room / playroom, and arranges furniture she bought with coins — tap a chair in the tray, tap a spot on the floor, it pops into place. A calm, creative, no-fail space that's *hers*.

---

## 2. Locked decisions

- **Flat-cartoon procedural SVG** (no AI art) — same register as the rest of the app.
- **Grid-snap placement** via **tap-to-place** (tap tray item → tap a valid cell → it snaps). No free-drag.
- **3 rooms** v1: **卧室 Bedroom · 客厅 Living Room · 游戏室 Playroom**, switchable by tabs.
- New **🏠 家** bottom-nav tab + new **🏠 家具 / Home** shop category (furniture bought with coins).
- **Per-child, private** — no visiting/showing-off (single child).
- Coins are the only currency (no XP/cards involved).

---

## 3. Rooms + grid model

- `HOME_ROOMS` (code constant): `['bedroom','living','playroom']`, each with bilingual name + a `RoomBackdrop` SVG (wall + floor, flat color) + grid dims.
- **Grid:** each room is a `COLS × ROWS` grid (v1: **8 × 6**). Rows split into zones: **wall** (top 2 rows) and **floor** (bottom 4 rows). A cell's zone constrains what can sit there.
- A placement occupies the cell(s) its footprint spans, anchored at `(gridX, gridY)`. v1 items are mostly **1×1**; a few are **2×1** (sofa, bed, shelf).

---

## 4. Furniture catalog (TS — `src/lib/home/furniture-catalog.tsx`)

`FurnitureDef = { slug, category, surface: 'wall'|'floor', footprint: {w,h}, nameZh, nameEn, rarity, priceCoins, Component: () => ReactElement }`. ~**18–20 items** v1 across categories (shown as shop sub-groups):

| Category | examples (slug) | surface |
|---|---|---|
| 墙饰 Wall art | `poster-stars`, `framed-fish`, `clock-round` | wall |
| 窗户/灯 Window & light | `window-sunny`, `lamp-floor`, `string-lights` | wall |
| 家具 Furniture | `bed-cozy`(2×1), `sofa-teal`(2×1), `chair-wood`, `table-round`, `bookshelf`(2×1), `toy-chest` | floor |
| 地毯 Rug | `rug-round`, `rug-stripe` | floor |
| 植物/玩具 Plants & toys | `plant-fern`, `plant-cactus`, `teddy-bear`, `ball-beach`, `rocket-lamp` | floor |

Prices mirror existing shop ranges (common 80–150 / rare 250–400 / epic 600–900). Each `Component` renders a flat-SVG `<g>` sized to its footprint cell-box (copy the avatar/decor SVG conventions). The catalog is the single source for both the shop and the room render.

---

## 5. Placement UX

`HomeRoomView` (`'use client'`) — two modes:

- **View mode** (default): the selected room's backdrop with all placed furniture; clean, no grid.
- **Edit mode** (a ✏️ toggle): shows a faint grid + a **bottom tray** of *owned-but-unplaced* furniture.
  - **Place:** tap a tray item → valid cells (matching `surface`, free of collision) highlight → tap a cell → `placeFurnitureAction` upserts the placement; the item moves from tray into the room.
  - **Move:** tap a placed item → it "lifts" (highlights valid cells) → tap a new cell → updates.
  - **Remove:** a placed item's lift state shows a "↩︎ 收起 / put away" affordance → `removeFurnitureAction` deletes the placement → item returns to the tray.
  - Reduced-motion safe; generous tap targets.

Room tabs (3) switch rooms; the tray + placements are per-room.

---

## 6. Shop integration

- New shop category **`home`** in `ShopCategory` + `ShopCategoryTabs` (🏠 家具). `ShopBody` renders a `HomeTabBody` listing `FURNITURE_CATALOG` items (grouped by category), with the standard buy → `PurchaseConfirmDialog` → `purchaseShopItemAction` flow.
- **Purchase dispatch:** add a `case 'home'` to `purchaseShopItemInTx` (coin debit + `shop_purchases` row only — owned furniture **derives from `shop_purchases`**, like pet/decor; no separate inventory table). Extend the trophy/grant logic only if trivial.
- **Seed:** `scripts/seed-home-furniture.ts` (mirrors `seed-decorations.ts`) upserts the ~18–20 `shop_items` rows (kind `home`, slug = furniture slug). Post-merge op.

---

## 7. Persistence + schema (migration ~0023)

```sql
-- One row per placed furniture item (owned items not in here = in the tray).
CREATE TABLE home_placements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  room        text NOT NULL,           -- 'bedroom' | 'living' | 'playroom'
  furniture_slug text NOT NULL,
  grid_x      integer NOT NULL,
  grid_y      integer NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, furniture_slug)    -- each owned item placed at most once
);
```
- Add **`'home'`** to the shop-item-kind enum (verify exact enum name — likely `shop_item_kind` in `src/db/schema/shop.ts`).
- Owned set = `SELECT slug FROM shop_purchases JOIN shop_items ... WHERE kind='home'` for the child. Tray = owned − placed.
- `HOME_ROOMS` / grid dims / `FURNITURE_CATALOG` live in **code**, not DB (like decor anchors + avatar catalog).

---

## 8. Server actions (`src/lib/actions/home.ts`, `'use server'`)

- `getHomeState(childId)` → `{ ownedSlugs, placements: {room,slug,x,y}[] }` (also fine to compute in the page server component).
- `placeFurnitureAction(childId, room, slug, x, y)` — `requireChild`; verify the child owns `slug`, the target cells match the item's `surface` + are within bounds + collision-free; upsert `home_placements` (move = update); `revalidatePath`. Returns ok/err (pure error classes in `src/lib/errors/home-errors.ts`).
- `removeFurnitureAction(childId, slug)` — delete the placement; revalidate.

Validation is server-authoritative; the client highlights valid cells but the action re-checks.

---

## 9. Files

**New**
- migration ~0023 + `src/db/schema/home.ts` (`home_placements`) + `'home'` enum value.
- `src/lib/home/furniture-catalog.tsx`, `src/lib/home/rooms.tsx` (room defs + `RoomBackdrop`s + grid dims).
- `src/lib/db/home.ts` (place/remove/getHomeState queries), `src/lib/actions/home.ts`, `src/lib/errors/home-errors.ts`.
- `src/app/play/[childId]/home/page.tsx`, `src/components/home/{HomeRoomView,RoomTabs,FurnitureTray,RoomGrid,PlacedFurniture}.tsx`.
- `src/components/shop/HomeTabBody.tsx`.
- `scripts/seed-home-furniture.ts`.
- Tests for each.

**Modified**
- `src/components/play/KidNavBar.tsx` (+ 🏠 tab), `src/components/shop/ShopCategoryTabs.tsx` + `ShopBody.tsx` (+ home category), `purchaseShopItemInTx` (+ `case 'home'`), `CLAUDE.md`.

---

## 10. Phasing (the plan will follow this)

1. **Data + catalog**: migration + schema, `furniture-catalog`, `rooms`, `home` db layer.
2. **Room render + placement**: `HomeRoomView` view+edit, tap-to-place, server actions, `/home` route. (Playable with hand-seeded ownership.)
3. **Shop tab + purchase dispatch + seed** + 🏠 nav tab.
4. **Polish + docs + gate + PR.** Maybe a styling checkpoint for the room/furniture look on local dev.

---

## 11. Out of scope (v1)

- AI-illustrated art; isometric; free-drag.
- Multi-room beyond the 3; room wall/floor *re-skinning* as purchasable (could be a later category).
- Visiting other kids' homes / sharing.
- Furniture rotation, stacking, or multi-buy of the same item (own 1, place 1).
- XP/quest hooks for the home (could add a "decorate your home" daily quest later).

---

## 12. Testing

- catalog: every furniture def has slug/category/surface/footprint/names/price/rarity + a render-smoke; slugs unique.
- rooms: 3 rooms, grid dims, zone split (wall/floor rows).
- placement validation (`placeFurnitureAction` / db): rejects unowned, out-of-bounds, wrong-surface, collision; allows + upserts valid; remove deletes; idempotent.
- purchase dispatch: `home` kind debits coins + writes `shop_purchases`; owned derives.
- UI: `HomeRoomView` renders placed items in view mode; edit mode shows tray + grid; tap-to-place flow calls the action; room tabs switch.

---

## 13. Done criteria

- 🏠 家 tab opens a 3-room home; bought furniture appears in the tray; tap-to-place snaps it to the grid; placements persist + reload; rooms switch.
- 🏠 家具 shop tab sells ~18–20 furniture items for coins.
- Existing island-decoration system untouched. `pnpm typecheck && lint && test && build` green; seed runs clean.
