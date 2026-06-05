# Voyage Board (Procedural Treasure-Map UI) — Design Spec

**Date:** 2026-06-05
**Status:** approved (design) — **supersedes** `2026-06-05-illustrated-map-ui-design.md` (the static-image approach)
**Context:** First attempt used a fixed 1:1 AI illustration with invisible hotspots (`MapBoard`). David's feedback: too small, no Week 1→10 numbering, and a single fixed image is limiting. He chose a **procedural treasure-map board** that fills a **16:9 landscape** screen with all weeks visible at once, clearly numbered. This keeps the treasure-map *style* but builds it in CSS/SVG so it scales, numbers the weeks, and isn't locked to a fixed image.

Built on branch `feat/illustrated-map-ui` (the static-image `MapBoard` + WebP work is replaced).

---

## 1. North Star

> Yinuo opens her island and sees a wide treasure map filling the screen — a winding sea route with 10 big numbered landmark medallions (① → ⑩). Cleared stops fly a 🏴, her current week glows with a little ⛵, future stops are locked. One tap dives into a week.

---

## 2. Locked decisions

- **Procedural** parchment+ocean canvas (CSS/SVG) — NOT a baked image. The two AI map PNGs/WebP are no longer used by the UI.
- **16:9 landscape**, all stops visible, **no scroll**. Stops laid out in a computed serpentine.
- **Weeks numbered** ① → ⑩ on big medallions with bilingual landmark names.
- Keep current home chrome (avatar header, coin, `MapHeaderPill`, `WeekStrip`); the board replaces the `IslandMap` area.
- **`IslandMap` stays** as the fallback for packs without a voyage config.
- **No coordinate tuning** — positions are computed by a layout function, so there's no per-landmark %-coord checkpoint.
- View Transitions morph preserved (`viewTransitionName: island-${weekId}`).
- No DB change, no migration, no recompile.

---

## 3. Config — `src/lib/play/map-boards.ts` (reshaped; pure, client-safe)

Replace the image+coords config with an ordered landmark roster per pack:

```ts
export interface VoyageStop {
  labelZh: string;
  labelEn: string;
  /** Landmark emoji shown in the medallion. */
  emoji: string;
}

export interface VoyageMap {
  nameZh: string;
  nameEn: string;
  /** Ordered to match weekNumber: stops[0] = week 1. */
  stops: VoyageStop[];
}

/** Keyed by curriculum pack slug. Packs absent here fall back to <IslandMap>. */
export const VOYAGE_MAPS: Record<string, VoyageMap> = { /* below */ };

export function getVoyageMap(packSlug: string): VoyageMap | null {
  return VOYAGE_MAPS[packSlug] ?? null;
}
```

### 3.1 Caribbean (`pirate-class-level-1`) — 10 stops

| Wk | 中文 | English | emoji |
|----|------|---------|-------|
| 1 | 旧哈瓦那 | Old Havana | 🏛️ |
| 2 | 大蓝洞 | Great Blue Hole | 🌀 |
| 3 | 伯利兹群岛度假村 | Belize Cayes Resort | 🏝️ |
| 4 | 图卢姆玛雅遗址 | Tulum Mayan Ruins | 🛕 |
| 5 | 黄貂鱼城 | Stingray City | 🐠 |
| 6 | 蓝山瀑布 | Blue Mountains Waterfall | 🏔️ |
| 7 | 托尔图盖罗海龟海滩 | Tortuguero Turtle Beach | 🐢 |
| 8 | 哥斯达黎加丛林 | Costa Rican Jungle | 🦜 |
| 9 | 皮通山 | The Pitons | ⛰️ |
| 10 | 托尔图加岛海盗巢穴 | Tortuga Pirate's Lair | 🏴‍☠️ |

### 3.2 Indian Ocean (`pirate-class-level-2`) — 9 stops

| Wk | 中文 | English | emoji |
|----|------|---------|-------|
| 1 | 毛里求斯瀑布 | Mauritius Waterfall | 💦 |
| 2 | 留尼汪海龟海滩 | Réunion Turtle Beach | 🐢 |
| 3 | 马斯喀特苏丹王宫 | Muscat Sultan's Palace | 🕌 |
| 4 | 塞舌尔花岗岩兽穴 | Seychelles Granites Lair | 🐉 |
| 5 | 查戈斯环礁 | Chagos Atoll | 🏝️ |
| 6 | 马尔代夫泻湖 | Maldives Lagoons | 🏖️ |
| 7 | 桑给巴尔香料镇 | Zanzibar Spice Town | 🧺 |
| 8 | 孙德尔本斯红树林 | Sundarbans Mangroves | 🌳 |
| 9 | 安达曼丛林 | Andaman Jungle | 🐯 |

---

## 4. Layout — `voyageLayout(total): {xPct,yPct}[]`

Pure function. Lays `total` stops in a **serpentine** within the 16:9 box, all visible:

- Up to **5 stops per row**; `rows = ceil(total/5)` (1–10 → 1–2 rows).
- Row 0 runs left→right, row 1 right→left (boustrophedon), so the route winds continuously.
- `xPct` evenly spaced within `[12, 88]` across the row's stop count; `yPct` per row within `[28, 74]` (2 rows → ~33% / ~70%; 1 row → ~50%).
- Returns centers in % of the board; the component positions medallions + draws the dotted route through them in order.

Deterministic and tested independently of the component.

---

## 5. `VoyageBoard` component — `src/components/play/VoyageBoard.tsx` (`'use client'`)

**Props:**
```ts
interface VoyageBoardProps {
  childId: string;
  packSlug: string;            // resolves getVoyageMap(packSlug) client-side
  islands: { weekId: string; completionPercent: number }[]; // ordered by weekNumber
}
```

**Render:**
- A `relative aspect-[16/9] w-full` parchment canvas:
  - Parchment fill (tea-stained CSS gradient + subtle texture), **torn-paper border**, **wave trim** top & bottom (small repeating SVG), a **compass rose** in a corner, and the pack title banner ("加勒比海 · Caribbean Sea") — all CSS/SVG, echoing the AI maps.
  - An inner ocean panel (teal gradient) where the route + stops sit.
- Compute `pos = voyageLayout(map.stops.length)`. Draw an **SVG dotted route** (`<path>` or segments) connecting `pos[i]→pos[i+1]`.
- For each `stops[i]` at `pos[i]` (translate -50%,-50%):
  - **published week** (`i < islands.length`): a `Link` to `/play/${childId}/week/${islands[i].weekId}` with `viewTransitionName: island-${weekId}`. A large medallion (wood/gold ring, ~13% board width, min 56px) showing the `emoji`; an overlapping **gold number badge ①…⑩** (use the index+1); the bilingual name on a small banner below.
    - `completionPercent >= 100` → 🏴 flag + a "cleared" stamp ring.
    - first island with `<100` → glow/pulse ring + a ⛵ marker (pulse suppressed under reduced motion).
    - `aria-label` = `${labelEn} — week ${i+1}` (+ " cleared"/" current").
  - **future stop** (`i >= islands.length`): faded medallion + 🔒, non-interactive, `aria-label` = `${labelEn} — locked`.
- `getVoyageMap(packSlug)` called inside the component (string prop only — no config object across the RSC boundary). Returns null → render nothing.
- Respects `useReducedMotion()`.

The visual styling (exact parchment/wave/compass treatment, medallion frame) is implementer craft echoing the provided art; the **structure** (16:9, serpentine, numbered medallions, route, states) is fixed.

---

## 6. Wiring — `src/app/play/[childId]/page.tsx`

- `const voyage = currentMap ? getVoyageMap(currentMap.slug) : null;`
- Non-empty branch: `voyage ? <VoyageBoard childId packSlug={currentMap!.slug} islands={...} /> : <IslandMap ... />`.
- All chrome above unchanged; empty-state unchanged. `islands.map((i) => ({ weekId, completionPercent }))` for the board.

---

## 7. Cleanup of the superseded static-image attempt

- Delete `src/components/play/MapBoard.tsx` + `tests/unit/map-board.test.tsx` (replaced by VoyageBoard).
- Reshape `src/lib/play/map-boards.ts` (image+coords → voyage roster) + its test.
- Remove the now-unused `public/maps/caribbean-sea.webp` + `indian-ocean.webp` (the UI no longer references them). Keep the source `.png`s in-repo for future reference (they informed the landmark names/order).

---

## 8. Out of scope (v1)

- Using the AI illustrations as art (procedural look chosen; PNGs kept only as reference).
- Decorations overlaid on the board (still on `IslandMap` fallback only).
- Authoring Indian Ocean weeks (its 9 stops stay locked until then).
- Parallax / animated ocean beyond the current-week pulse.
- Portrait-specific layout (16:9 chosen; on a portrait phone the board is a shorter wide band — acceptable).

---

## 9. Testing

- **`voyage-layout.test.ts`**: `voyageLayout(10)` → 10 positions, all `xPct/yPct` in [0,100]; ≤5 per row; row 1 reversed (serpentine — first stop of row 1 has a larger xPct than its last, or assert the boustrophedon ordering); `voyageLayout(9)` → 9; `voyageLayout(1)` → 1 centered-ish.
- **`map-boards.test.ts`** (reshaped): both packs present; Caribbean 10 stops, Indian Ocean 9; each stop has non-empty `labelZh/labelEn/emoji`; `getVoyageMap('school-custom')` → null.
- **`voyage-board.test.tsx`**: given a configured slug + N islands → N tappable medallion links (href + viewTransitionName); `(stops-N)` locked medallions; a 100% island shows the flag; the first <100% shows the current marker; unconfigured pack → renders nothing; reduced motion → no pulse.
- **home chooser**: VoyageBoard when configured, IslandMap otherwise (typecheck + existing IslandMap tests cover the fallback).

---

## 10. Files

**New**
- `src/lib/play/voyage-layout.ts` — `voyageLayout`.
- `src/components/play/VoyageBoard.tsx`.
- tests per §9.

**Modified**
- `src/lib/play/map-boards.ts` — reshaped to `VOYAGE_MAPS` + `getVoyageMap`.
- `tests/unit/map-boards.test.ts` — reshaped.
- `src/app/play/[childId]/page.tsx` — chooser uses VoyageBoard.
- `CLAUDE.md` — PR entry + landmine.

**Deleted**
- `src/components/play/MapBoard.tsx`, `tests/unit/map-board.test.tsx`, `public/maps/*.webp`.

---

## 11. Build flow

spec → plan → build (subagent TDD) → **styling checkpoint** (David eyeballs the parchment/medallion look + numbering on the local dev or a preview; tweak styling) → docs + four-green gate → un-draft & merge PR #65 (repurposed). No coordinate tuning needed.

---

## 12. Done criteria

- Caribbean home shows a 16:9 procedural treasure map; 10 numbered medallions on a winding route, all visible without scrolling; cleared flags, current-week glow, tap → week hub with morph.
- Indian Ocean (on switch) shows 9 numbered stops, all locked.
- Unconfigured packs still render `IslandMap`.
- No image dependency; `pnpm typecheck && lint && test && build` green.
