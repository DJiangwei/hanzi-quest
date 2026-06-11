# 家 / My Home — Polished flat 2.5D + swappable wallpaper/flooring

> **Status:** direction approved by David (chose "Polished flat 2.5D + wallpaper/flooring" over
> the full isometric rework, after a rendered 4-way mockup). Phased.

## Why

The home rooms are flat colour blocks (front-on `100×75` viewBox: a flat wall band + flat floor
+ thin lines, furniture as flat-SVG rectangles). David wants it "更优雅更现代游戏" — more
elegant, more like a modern game — plus better decoration design + expansion.

We deliberately did NOT pick isometric (biggest rework: new grid math + redraw every furniture
as a 3/4 sprite). Instead: keep the front-on camera + the existing 8×6 grid, and (A) do a
**polish art pass** so it reads like a real game, then (B) add **swappable wallpaper + flooring**
— the highest-impact decoration expansion, reusing the shop/equip system.

## Phasing

- **Phase A — Polished flat 2.5D art pass (PR-A):** pure art/CSS, NO DB, NO new mechanics.
  Ships the elegant feel immediately and de-risks everything.
- **Phase B — Swappable wallpaper + flooring (PR-B):** new surfaces catalog + a per-room
  equipped-surface table + shop section + equip UI. Builds on Phase A (the polished backdrops
  become the *default* surfaces).

Ship A first; B second.

---

## Phase A — Polished flat 2.5D art pass

Keep the camera, grid, viewBox (`0 0 100 75`), placement mechanics, and footprints **unchanged**.
Only the *rendering* gets richer.

### A1. Depth system (shared) — `RoomCanvas` / `PlacedFurniture`
- **Soft drop-shadow under every placed item**: render a translucent ellipse (`fill #000
  opacity ~0.08–0.12`) at the item's base before the item `<g>`. Centralize in
  `PlacedFurniture` so all 20 items get it for free.
- **Ambient light pool**: one large soft radial-gradient overlay on the floor (warm, ~0.15
  opacity) for a lit-room feel.
- **Cove shadow**: a thin dark-to-transparent gradient strip just under the ceiling line.
- All gradients via `<defs>` with **`useId()`-scoped ids** (multiple rooms/instances on a page
  must not collide — same landmine as `AvatarRender`).
- Respect `prefers-reduced-motion` only where motion exists (these are static; no issue), but
  keep it all SSR-safe (no JS).

### A2. Backdrops — `rooms.tsx` (3 rooms)
Repaint each `Backdrop()`:
- **Wall**: vertical linear gradient (light top → slightly deeper bottom) in a cohesive palette;
  keep a subtle wallpaper motif (stripe/dot/diamond) but lower-contrast; add the cove shadow.
- **Skirting board**: a board with a highlight line on top + shadow line under (reads 3D).
- **Floor**: gradient fill + soft plank/tile lines at lower opacity + the light pool.
- Palettes stay per-room (bedroom warm / living cool / playroom bright) but unified in
  saturation + value so all three feel like one game.

### A3. Furniture — `furniture-catalog.tsx` (~20 `Component()`s)
Repaint each with the **shared recipe** (so 20 items stay consistent):
1. **Rounded forms** (`rx` on rects; rounded paths) instead of hard rectangles.
2. **3-tone shading per item**: base + a lighter top/highlight band + a darker side/under tone.
   (Flat-colour rule from the avatar items is relaxed here — furniture may use a couple of
   shades, but still NO gradients with shared `<defs>` ids inside the item `<g>`; use solid
   shade tones so footprint cells compose safely. Light source = top-left, consistent.)
3. Keep the **footprint** + cell math identical (no layout/placement change).

This is the bulk of Phase A (20 components) — mechanical but careful. A `home-art.md` recipe
note (light direction, shade tones, corner radius) keeps them uniform.

### A4. Tests (Phase A)
- `PlacedFurniture`: asserts a shadow ellipse renders behind the item.
- `rooms`: each backdrop still renders (smoke) + the new defs ids are `useId`-scoped (no
  duplicate-id collision across two rendered rooms — render two `RoomCanvas` and assert unique
  gradient ids).
- All existing home tests stay green; four-green gate.

No DB, no migration, no recompile.

---

## Phase B — Swappable wallpaper + flooring

Let the kid **buy + equip** a wallpaper (wall zone) and a floor (floor zone) per room,
replacing the hardcoded default. Highest-impact expression upgrade; reuses shop + equip.

### B1. Surfaces catalog — `src/lib/home/surfaces.ts`
```
type SurfaceKind = 'wallpaper' | 'floor';
interface SurfaceDef {
  slug: string; kind: SurfaceKind;
  nameZh: string; nameEn: string;
  rarity: 'common'|'rare'|'epic'; priceCoins: number;
  isDefault?: boolean;          // the free starter surfaces (per room palette)
  /** SVG <g> filling ONLY its zone: wall = 0..25y, floor = 25..75y (viewBox 100×75). */
  render: () => ReactElement;
}
```
Ship ~**5 wallpapers + 5 floors** at launch (e.g. wallpapers: 条纹米色 / 星空 / 粉彩波点 / 木板 /
航海蓝; floors: 蜜色木地板 / 灰石砖 / 海草绿 / 棋盘格 / 云朵地毯). Plus the 3 current room
palettes as the **defaults** (free, pre-owned). Bilingual per the locked rule.

### B2. DB — migration `00NN`
- New `home_room_surfaces(child_id, room, wallpaper_slug, floor_slug)`, **PK (child_id, room)**.
  Absent row → defaults for that room. Equip upserts (`onConflictDoUpdate`).
- **Ownership reuses `shop_purchases` kind `'home'`** (already in the enum + handled generically
  by `purchaseShopItemInTx`) — surfaces seed `shop_items(kind='home', slug=<surface slug>)`.
  No enum migration; furniture vs surface is disambiguated by which catalog the slug is in.
  (Defaults need no purchase — equippable without ownership.)

### B3. Render — `rooms.tsx`
Split `Backdrop()` into `WallSurface` + `FloorSurface` layers driven by the equipped
(or default) surface slugs. `RoomCanvas` takes `wallpaperSlug` / `floorSlug` props (resolved
server-side per active room from `home_room_surfaces`, defaults applied) → renders the chosen
surface's `render()` for each zone. The Phase-A polish (cove, light pool, skirting, shadows)
stays as an overlay independent of the chosen surface.

### B4. Shop — `HomeTabBody`
Add a **sub-tab / segmented control**: 家具 Furniture · 墙纸 Wallpaper · 地板 Floor. Wallpaper/
floor cards show a swatch preview (`render()` in a small viewBox) + bilingual name + price;
buy via the existing `purchaseShopItemAction`.

### B5. Equip UI — `HomeRoomView`
In edit mode, a **change-surface control** for the active room: two pickers (墙纸 / 地板) listing
owned + default surfaces; tap → `setRoomSurfaceAction(childId, room, kind, slug)` (optimistic,
revalidates). Server validates ownership (owned OR default).

### B6. New code (Phase B)
- `src/lib/home/surfaces.ts` (catalog), `src/lib/db/home-surfaces.ts` (`getRoomSurfaces`,
  `setRoomSurfaceInTx` with ownership check), `src/lib/actions/home-surfaces.ts`
  (`setRoomSurfaceAction`), `scripts/seed-home-surfaces.ts` (seed shop_items for the 10 surfaces),
  `src/components/home/SurfacePicker.tsx`, swatch in shop.
- Drizzle: edit `src/db/schema/home.ts` → generate migration. Append-only.

### B7. Tests (Phase B)
- `surfaces` catalog: defaults flagged, slugs unique, every room has a default wallpaper+floor.
- `home-surfaces` db: equip upsert, ownership rejection (non-owned non-default), default
  fallback when no row.
- `SurfacePicker`: lists owned+default, bilingual labels.
- Shop sub-tab renders wallpaper/floor cards.

---

## Risks / landmines
- **`useId()` for all gradient/clip ids** — two rooms (or shop swatches) on one page collide
  otherwise. Same hazard as `AvatarRender`.
- **Furniture shading uses solid shade tones, not shared-id gradients** — items compose into one
  SVG; a `<defs>` gradient id inside an item `<g>` would collide across items. Use 2–3 solid
  tones per item (top-left light source) for the 2.5D look without gradients.
- **Phase B reuses `shop_purchases` kind `'home'`** — don't add new enum values; the surface vs
  furniture distinction is catalog membership. `purchaseShopItemInTx`'s `'home'` branch already
  works (no inventory side-effect, just debit + purchase row).
- **Defaults are equippable without ownership** — `setRoomSurfaceInTx` allows a slug that is
  `isDefault` OR owned; never require buying the starter surfaces.
- **Bilingual rule** applies to every new label (shop sub-tabs, surface names, picker).
- Local `pnpm build` applies Phase-B migration to prod (additive, safe).

## Verification
1. Phase A: open 家, each room reads as a lit, shaded, cohesive scene; placed furniture casts
   soft shadows; visual parity of placement mechanics.
2. Phase B: buy a wallpaper + a floor in the shop; equip them per room; the room repaints; other
   rooms unaffected; defaults work with zero purchases.
