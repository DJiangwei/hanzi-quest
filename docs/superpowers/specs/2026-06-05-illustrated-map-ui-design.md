# Illustrated Map UI — Design Spec

**Date:** 2026-06-05
**Status:** approved (design)
**Context:** The home screen renders a procedural `IslandMap` (island circles laid out by `positionFor(index)`, linked to each week hub). David provided two finished 2048×2048 treasure-map illustrations — **Caribbean Sea** (Map 1, pack `pirate-class-level-1`, 10 published weeks) and **Indian Ocean** (Map 2, pack `pirate-class-level-2`, 0 weeks) — and wants them to BE the map UI: each week's content sits on a landmark icon, tapped to enter that week. This replaces the procedural layout for packs that have a configured illustrated map, while keeping `IslandMap` as a fallback.

This supersedes the previously-queued "post-reveal card polish" PR.

---

## 1. North Star

> Yinuo opens her island and sees a beautiful hand-drawn treasure map. Each week is a landmark she can tap to dive in; cleared weeks fly a 🏴 flag; future stops are locked "coming soon" islands she's working toward.

---

## 2. Locked decisions

- **Keep current home chrome** (avatar header, coin pill, `MapHeaderPill`, `WeekStrip`, `LatestChapterPill`). Only the `IslandMap` area is replaced by the new `MapBoard`.
- **Hotspot coords**: baked %-estimates in a TS config + a **preview fine-tune checkpoint** (David nudges coords on a deployed preview).
- **Decorations are NOT overlaid** on illustrated maps in v1 (the illustration supersedes them). Purchased decor still renders on `IslandMap`-fallback packs. (Known tradeoff, accepted.)
- **Images → WebP** (<~700KB each) served via `next/image`.
- **`IslandMap` stays** as the fallback for packs without a `MAP_BOARDS` entry (e.g. `school-custom`).
- **View Transitions morph preserved**: hotspots keep `viewTransitionName: island-${weekId}`.

---

## 3. Asset prep

- Source PNGs committed at `public/maps/caribbean-sea.png` + `public/maps/indian-ocean.png` (2048², ~8MB each).
- Convert each to WebP at `public/maps/caribbean-sea.webp` + `public/maps/indian-ocean.webp` (quality ~80, target <700KB). Use a local one-off (`sips`/`cwebp`/sharp) — committed as static assets; **no runtime conversion**. The `.webp` files are what the app references; the source `.png`s are kept in-repo for future re-exports.
- Square aspect ratio (1:1). The board fits the content column width and scales; hotspots are positioned in % so they scale with it.

---

## 4. Config — `src/lib/play/map-boards.ts` (pure, client-safe — NO db imports)

```ts
export interface MapHotspot {
  /** Center X as % of image width (0–100). */
  xPct: number;
  /** Center Y as % of image height (0–100). */
  yPct: number;
  /** Landmark scenery name (display only; weeks teach hanzi, not geography). */
  labelZh: string;
  labelEn: string;
}

export interface MapBoardConfig {
  /** WebP under /public. */
  imageSrc: string;
  /** Bilingual map name (matches the pack). */
  nameZh: string;
  nameEn: string;
  /** Ordered to match weekNumber: hotspots[0] = week 1, … last = final landmark. */
  hotspots: MapHotspot[];
}

/** Keyed by curriculum pack slug. Packs absent here fall back to <IslandMap>. */
export const MAP_BOARDS: Record<string, MapBoardConfig> = { /* below */ };

export function getMapBoard(packSlug: string): MapBoardConfig | null {
  return MAP_BOARDS[packSlug] ?? null;
}
```

### 4.1 Caribbean Sea (`pirate-class-level-1`) — 10 hotspots (estimated, tune on preview)

Order = a serpentine voyage ending at the X (Tortuga Pirate's Lair):

| Wk | Landmark | xPct | yPct |
|----|----------|------|------|
| 1 | Old Havana / 旧哈瓦那 | 20 | 33 |
| 2 | Great Blue Hole / 大蓝洞 | 50 | 27 |
| 3 | Belize Cayes Resort / 伯利兹群岛度假村 | 80 | 28 |
| 4 | Tulum Mayan Ruins / 图卢姆玛雅遗址 | 83 | 56 |
| 5 | Stingray City / 黄貂鱼城 | 50 | 49 |
| 6 | Blue Mountains Waterfall / 蓝山瀑布 | 22 | 55 |
| 7 | Tortuguero Turtle Beach / 托尔图盖罗海龟海滩 | 20 | 72 |
| 8 | Costa Rican Jungle / 哥斯达黎加丛林 | 17 | 87 |
| 9 | The Pitons / 皮通山 | 50 | 84 |
| 10 | Tortuga Pirate's Lair / 托尔图加岛海盗巢穴 | 80 | 84 |

### 4.2 Indian Ocean (`pirate-class-level-2`) — 9 hotspots (estimated; all locked until weeks authored)

| Wk | Landmark | xPct | yPct |
|----|----------|------|------|
| 1 | Mauritius Waterfall / 毛里求斯瀑布 | 17 | 35 |
| 2 | Réunion Turtle Beach / 留尼汪海龟海滩 | 45 | 28 |
| 3 | Muscat Sultan's Palace / 马斯喀特苏丹王宫 | 75 | 27 |
| 4 | Seychelles Granites Lair / 塞舌尔花岗岩兽穴 | 80 | 55 |
| 5 | Chagos Atoll / 查戈斯环礁 | 47 | 52 |
| 6 | Maldives Lagoons / 马尔代夫泻湖 | 20 | 60 |
| 7 | Zanzibar Spice Town / 桑给巴尔香料镇 | 17 | 78 |
| 8 | Sundarbans Mangroves / 孙德尔本斯红树林 | 48 | 82 |
| 9 | Andaman Jungle / 安达曼丛林 | 78 | 80 |

> All coordinates are **estimates** to be fine-tuned on the preview. Generous tap targets (≈14% width, min 44px) mean ±5% is still on-landmark.

---

## 5. `MapBoard` component — `src/components/play/MapBoard.tsx` (`'use client'`)

**Props:**
```ts
interface MapBoardProps {
  childId: string;
  packSlug: string;            // resolves MAP_BOARDS[packSlug] client-side
  islands: {                   // ordered by weekNumber (same shape IslandMap receives)
    weekId: string;
    completionPercent: number;
  }[];
}
```

**Render:**
- A `relative` container, aspect-ratio 1:1, max-width = content column. The map image via `next/image` (`fill`, `sizes` set, `priority` since it's above the fold), `alt` = the bilingual map name.
- For each `hotspots[i]` (i from 0..hotspots.length-1), absolutely positioned at `left: xPct%`, `top: yPct%`, `translate(-50%,-50%)`:
  - **`i < islands.length` (published week):** a `Link` to `/play/${childId}/week/${islands[i].weekId}` with `style={{ viewTransitionName: 'island-' + islands[i].weekId }}`. Round tap target (≈14% width, min 44×44). 
    - `completionPercent >= 100` → 🏴 flag badge + a faint "cleared" ring.
    - the first island with `completionPercent < 100` → a gentle **pulse ring** ("you are here"), suppressed under reduced-motion.
    - `aria-label` = `${labelEn} — week ${i+1}`.
  - **`i >= islands.length` (future landmark):** a non-interactive 🔒 badge ("coming soon"), `aria-label` = `${labelEn} — locked`. (Indian Ocean shows 9 locked stops until weeks are authored.)
- Reduced motion: no pulse/idle animation; static badges only.

**Notes:**
- `MapBoard` calls `getMapBoard(packSlug)` itself (client-side) — `packSlug` is a string prop, never pass the config object across the RSC boundary (PackUiMeta-style hazard).
- If `getMapBoard` returns null (shouldn't happen — page only renders MapBoard when configured), render nothing and log.

---

## 6. Wiring — `src/app/play/[childId]/page.tsx`

- The page already computes the current pack and `islands` (ordered by weekNumber). Determine the current pack **slug**.
- If `getMapBoard(slug)` is non-null → render `<MapBoard childId packSlug islands={islands} />` in place of `<IslandMap>`.
- Else → render the existing `<IslandMap ... decorations={...} />` exactly as today.
- All chrome above (avatar header, coin, `MapHeaderPill`, `WeekStrip`, `LatestChapterPill`) is unchanged. The empty-state ("No islands yet") branch is unchanged.
- The page must have the current pack **slug** available. If it currently only has the pack name/id, add a `slug` to the query that produces `currentMap` (or fetch it) — minimal additive read.

---

## 7. Out of scope (v1)

- Overlaying purchased decorations on illustrated maps (deliberate cut; decor still works on `IslandMap` fallback).
- Authoring Indian Ocean weeks (separate work; its 9 stops stay locked until then).
- Animating the map itself (parallax, ambient motion) — static illustration only.
- Per-landmark unique reveal/sound. The boss/scene systems are untouched.
- Replacing the `MapHeaderPill` or restructuring home chrome (immersive layout was declined).
- Drag-to-reposition or an in-app coordinate editor (coords are tuned by editing the TS config + preview).

---

## 8. Testing

- **`map-boards.test.ts`**: both packs present; each hotspot has `xPct`/`yPct` in [0,100] and non-empty `labelZh`/`labelEn`; Caribbean has 10, Indian Ocean has 9; `getMapBoard('school-custom')` → null; `getMapBoard('pirate-class-level-1')` → the Caribbean config.
- **`map-board.test.tsx`**: given a config slug + N islands, renders exactly N tappable hotspot links (correct `href` + `viewTransitionName`); renders `(hotspots.length - N)` locked badges; a 100% island shows the flag badge; the first <100% island shows the "current" marker; with `useReducedMotion` true → no pulse.
- **home page test** (or a thin selector test): picks `MapBoard` when the pack has a config, `IslandMap` otherwise. (If the existing home test is heavy, add a focused test on the chooser logic.)

---

## 9. Files

**New**
- `public/maps/caribbean-sea.webp`, `public/maps/indian-ocean.webp` (+ source `.png`s already committed)
- `src/lib/play/map-boards.ts`
- `src/components/play/MapBoard.tsx`
- tests per §8

**Modified**
- `src/app/play/[childId]/page.tsx` — chooser (MapBoard vs IslandMap) + ensure current pack slug is available.
- `CLAUDE.md` — PR entry + landmine (map-boards is client-only config; coords are %-based + tuned on preview; decor not shown on illustrated maps).

---

## 10. Build flow

spec → plan → build (subagent TDD) → **preview checkpoint** (David fine-tunes the 19 hotspot coordinates by editing `map-boards.ts` values against the deployed preview; generous tap targets mean small nudges) → docs + four-green gate → merge. No DB change, no migration, no recompile.

---

## 11. Done criteria

- On Caribbean, the home map is the illustration; all 10 weeks are tappable on their landmarks (after coord tuning); cleared weeks fly a flag; tapping morphs into the week hub.
- On Indian Ocean (current pack switch), the illustration shows with 9 locked stops.
- `school-custom` (or any unconfigured pack) still renders the procedural `IslandMap`.
- Map WebP < ~700KB each; `next/image` serves them; no 8MB payload.
- `pnpm typecheck && lint && test && build` green.
