# 家 / Home — Yard room + room-art polish + bigger canvas

> Small follow-up PR to #83 (home polish 2.5D). David's playtest: the **furniture** got repainted but the **rooms** still read as flat/small, and he wants an outdoor space.

## Goals (3)

1. **Polish room art** so walls/floors read as "modern game", matching the repainted furniture.
2. **Enlarge the room canvas** — it's too small on screen (capped at `max-w-md`).
3. **Add a 4th room: 院子 / Yard** (outdoor), with its own swappable sky + ground surfaces and 5 outdoor furniture items.

## Decisions (locked with David, 2026-06-11)

- **Yard surfaces** = reuse the existing surface system. Top zone (rows 0–1) = **sky** (a `wallpaper`-kind surface); bottom zone (rows 2–5) = **ground** (a `floor`-kind surface). Consistent with the 3 indoor rooms; Yinuo can swap both.
- **Outdoor furniture** = add 5 new items (swing / sandbox / picnic table / little tree / flower bed), sold in the existing `home` shop category, placeable in any room (surface = `floor`).
- **"Bigger"** = enlarge the on-screen canvas only (widen the page container; let the `w-full` SVG grow). Grid stays **8×6** — placement math unchanged.

## Design

### A. New room (`src/lib/home/rooms.tsx`)
- Extend `HomeRoomId` union with `'yard'`.
- Add an `emoji` field to `RoomDef` (kills the hardcoded 3-way emoji ternary in `RoomTabs` / `HomeRoomView`); set 🛏️ 🛋️ 🎮 🌳.
- Add a `yard` `RoomDef` (cols 8, rows 6, wallRows 2 — top 2 rows are the **sky** zone). `Backdrop` stays in the interface (back-compat, unused by `RoomCanvas`) — give yard a simple sky+grass backdrop.

### B. Surfaces (`src/lib/home/surfaces.ts`)
- New **defaults (free)**: `sky-day` (wallpaper), `ground-lawn` (floor).
- New **buyables**: `sky-sunset` (wallpaper, rare 320), `ground-sand` (floor, common 240), `ground-deck` (floor, common 240).
- `ROOM_DEFAULT_SURFACES.yard = { wallpaper: 'sky-day', floor: 'ground-lawn' }`.
- **Polish** the 3 indoor default surface renders (deeper, less-washed-out gradients + a touch more texture). Catalog is shared across rooms (a sky in a bedroom is allowed — whimsical, fine).

### C. Depth polish (`src/components/home/RoomCanvas.tsx`)
- Strengthen the generic 2.5D overlay (applies to all rooms at once): corner **ambient-occlusion vignette** + a soft **window-light wash** + a more readable baseboard/horizon line. All `useId`-scoped. Must still look OK over the yard (horizon = grass/sky line, light pool = sunlight).

### D. Outdoor furniture (`src/lib/home/furniture-catalog.tsx`)
5 new `FurnitureDef`s (surface `floor`), mapped onto existing categories (no enum change): swing/sandbox/picnic-table → `furniture`; little-tree/flower-bed → `plant_toy`. Hand-rolled SVG, same shading language as the repainted set.

### E. Bigger canvas (`src/app/play/[childId]/home/page.tsx`)
`max-w-md` → `max-w-2xl lg:max-w-4xl`. SVG is `w-full`, so it grows. No layout-math change.

### F. Tabs / labels
`RoomTabs` and `HomeRoomView` read `room.emoji` + names from `getRoom(activeRoom)` instead of 3-way ternaries → the 4th tab appears automatically.

## Out of scope
- Grid resize (8×6 stays). Outdoor-only placement rules (wall-art in the sky is allowed). New furniture *categories*. Any DB migration.

## Tests
- `rooms.test.tsx`: 3 → 4 rooms; add `yard` to the `it.each` lists + a `room.emoji` assertion.
- `surfaces.test.ts`: already generic (unique slugs / non-empty) — passes; add a yard-default-resolves check.
- Add: outdoor furniture exists in catalog + has `floor` surface.

## Post-merge ops (shared prod DB)
- `pnpm tsx scripts/seed-home-furniture.ts` (+5 outdoor items)
- `pnpm tsx scripts/seed-home-surfaces.ts` (+3 buyable surfaces)

No migration, no recompile.
