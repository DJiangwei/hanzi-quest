# Voyage Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home island map with a procedural 16:9 treasure-map "voyage board" — all weeks visible as big numbered landmark medallions on a winding route — keeping `IslandMap` as a fallback.

**Architecture:** A pure `voyageLayout` lays N stops in a serpentine; a reshaped `map-boards.ts` holds per-pack landmark rosters (name + emoji, no image/coords); `VoyageBoard` renders a CSS/SVG parchment+ocean canvas with a dotted route and per-stop medallions; the home page chooses VoyageBoard when the pack has a config. Supersedes the static-image `MapBoard` (deleted).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-05-voyage-board-design.md`
**Branch:** `feat/illustrated-map-ui` (repurposed; draft PR #65). Dev server already running for the styling checkpoint.

---

## Context: what already exists on this branch (to be replaced)

- `src/lib/play/map-boards.ts` — image+coords config (`MAP_BOARDS`, `MapHotspot{xPct,yPct,labelZh,labelEn}`, `getMapBoard`). **Reshape** to the voyage roster.
- `src/components/play/MapBoard.tsx` + `tests/unit/map-board.test.tsx` — **delete**.
- `tests/unit/map-boards.test.ts` — **reshape**.
- `public/maps/caribbean-sea.webp`, `indian-ocean.webp` — **delete** (keep the `.png`s).
- `src/app/play/[childId]/page.tsx` — currently: `const mapBoard = currentMap ? getMapBoard(currentMap.slug) : null;` and a `mapBoard ? <MapBoard …> : <IslandMap …>` ternary. **Rewire** to VoyageBoard.
- Home page provides `islands` = `{weekId, weekNumber, label, completionPercent}[]` (ordered by weekNumber) and `currentMap.slug`.
- `IslandMap` links use `style={{ viewTransitionName: \`island-${weekId}\` }}` → preserve the morph in VoyageBoard.
- `useReducedMotion()` from `@/lib/hooks/use-reduced-motion`.

---

## Task 1: `voyageLayout` (pure serpentine layout)

**Files:** Create `src/lib/play/voyage-layout.ts`; Test `tests/unit/voyage-layout.test.ts`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/voyage-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { voyageLayout } from '@/lib/play/voyage-layout';

describe('voyageLayout', () => {
  it('returns one position per stop, all in 0–100', () => {
    const pts = voyageLayout(10);
    expect(pts).toHaveLength(10);
    for (const p of pts) {
      expect(p.xPct).toBeGreaterThanOrEqual(0);
      expect(p.xPct).toBeLessThanOrEqual(100);
      expect(p.yPct).toBeGreaterThanOrEqual(0);
      expect(p.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('uses at most 5 stops per row (two rows for 10)', () => {
    const pts = voyageLayout(10);
    const rows = new Set(pts.map((p) => p.yPct));
    expect(rows.size).toBe(2);
  });

  it('runs row 0 left→right and row 1 right→left (serpentine)', () => {
    const pts = voyageLayout(10);
    // row 0 = first 5 ascending x; row 1 = next 5 descending x
    expect(pts[0].xPct).toBeLessThan(pts[4].xPct);
    expect(pts[5].xPct).toBeGreaterThan(pts[9].xPct);
    // the transition stop (index 5) sits under the end of row 0 (similar x to index 4)
    expect(Math.abs(pts[5].xPct - pts[4].xPct)).toBeLessThan(15);
  });

  it('centers a single row vertically', () => {
    const pts = voyageLayout(4);
    expect(new Set(pts.map((p) => p.yPct)).size).toBe(1);
    expect(pts[0].yPct).toBeGreaterThan(40);
    expect(pts[0].yPct).toBeLessThan(60);
  });

  it('handles 1 and 9 stops without throwing', () => {
    expect(voyageLayout(1)).toHaveLength(1);
    expect(voyageLayout(9)).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/voyage-layout.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Create `src/lib/play/voyage-layout.ts`:

```ts
export interface VoyagePoint {
  /** Center X as % of board width. */
  xPct: number;
  /** Center Y as % of board height. */
  yPct: number;
}

const PER_ROW = 5;
const X_MIN = 12;
const X_MAX = 88;

/**
 * Lays `total` stops in a serpentine (boustrophedon) inside a 16:9 board:
 * up to 5 per row, row 0 left→right, row 1 right→left, … Single row is
 * vertically centered; two rows sit at ~33% / ~70%.
 */
export function voyageLayout(total: number): VoyagePoint[] {
  if (total <= 0) return [];
  const rows = Math.ceil(total / PER_ROW);
  const rowY =
    rows === 1 ? [50] : Array.from({ length: rows }, (_, r) => 28 + (r * 46) / (rows - 1));

  const out: VoyagePoint[] = [];
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / PER_ROW);
    const countInRow = Math.min(PER_ROW, total - row * PER_ROW);
    let col = i - row * PER_ROW;
    if (row % 2 === 1) col = countInRow - 1 - col; // serpentine reverse
    const xPct =
      countInRow === 1 ? (X_MIN + X_MAX) / 2 : X_MIN + (col * (X_MAX - X_MIN)) / (countInRow - 1);
    out.push({ xPct, yPct: rowY[row] });
  }
  return out;
}
```

> For 10 stops: rows=2, rowY=[28,74]. Row 0 cols 0..4 → x 12..88 ascending. Row 1 (indices 5..9): index 5 col=4 (reversed) → x=88 (matches index 4's 88, satisfying the "transition stop under end of row 0" test); index 9 col=0 → x=12. So row 1 descends 88→12. ✓

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/voyage-layout.test.ts` → PASS. `pnpm typecheck` → clean.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/play/voyage-layout.ts tests/unit/voyage-layout.test.ts
git commit -m "feat(voyage-board): voyageLayout serpentine positioning"
```

---

## Task 2: Reshape `map-boards.ts` → `VOYAGE_MAPS`

**Files:** Modify `src/lib/play/map-boards.ts`; Modify `tests/unit/map-boards.test.ts`.

- [ ] **Step 1: Rewrite the test** (`tests/unit/map-boards.test.ts`) to the new shape:

```ts
import { describe, expect, it } from 'vitest';
import { VOYAGE_MAPS, getVoyageMap } from '@/lib/play/map-boards';

describe('voyage maps config', () => {
  it('has Caribbean (10 stops) and Indian Ocean (9 stops)', () => {
    expect(getVoyageMap('pirate-class-level-1')?.stops).toHaveLength(10);
    expect(getVoyageMap('pirate-class-level-2')?.stops).toHaveLength(9);
  });

  it('returns null for unconfigured packs', () => {
    expect(getVoyageMap('school-custom')).toBeNull();
    expect(getVoyageMap('nope')).toBeNull();
  });

  it('every stop has bilingual labels + an emoji', () => {
    for (const m of Object.values(VOYAGE_MAPS)) {
      expect(m.nameZh).toBeTruthy();
      expect(m.nameEn).toBeTruthy();
      for (const s of m.stops) {
        expect(s.labelZh).toBeTruthy();
        expect(s.labelEn).toBeTruthy();
        expect(s.emoji).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/map-boards.test.ts` → FAIL (old exports gone).

- [ ] **Step 3: Replace `src/lib/play/map-boards.ts`** entirely with:

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
export const VOYAGE_MAPS: Record<string, VoyageMap> = {
  'pirate-class-level-1': {
    nameZh: '加勒比海',
    nameEn: 'Caribbean Sea',
    stops: [
      { labelZh: '旧哈瓦那', labelEn: 'Old Havana', emoji: '🏛️' },
      { labelZh: '大蓝洞', labelEn: 'Great Blue Hole', emoji: '🌀' },
      { labelZh: '伯利兹群岛度假村', labelEn: 'Belize Cayes Resort', emoji: '🏝️' },
      { labelZh: '图卢姆玛雅遗址', labelEn: 'Tulum Mayan Ruins', emoji: '🛕' },
      { labelZh: '黄貂鱼城', labelEn: 'Stingray City', emoji: '🐠' },
      { labelZh: '蓝山瀑布', labelEn: 'Blue Mountains Waterfall', emoji: '🏔️' },
      { labelZh: '托尔图盖罗海龟海滩', labelEn: 'Tortuguero Turtle Beach', emoji: '🐢' },
      { labelZh: '哥斯达黎加丛林', labelEn: 'Costa Rican Jungle', emoji: '🦜' },
      { labelZh: '皮通山', labelEn: 'The Pitons', emoji: '⛰️' },
      { labelZh: '托尔图加岛海盗巢穴', labelEn: "Tortuga Pirate's Lair", emoji: '🏴‍☠️' },
    ],
  },
  'pirate-class-level-2': {
    nameZh: '印度洋',
    nameEn: 'Indian Ocean',
    stops: [
      { labelZh: '毛里求斯瀑布', labelEn: 'Mauritius Waterfall', emoji: '💦' },
      { labelZh: '留尼汪海龟海滩', labelEn: 'Réunion Turtle Beach', emoji: '🐢' },
      { labelZh: '马斯喀特苏丹王宫', labelEn: "Muscat Sultan's Palace", emoji: '🕌' },
      { labelZh: '塞舌尔花岗岩兽穴', labelEn: 'Seychelles Granites Lair', emoji: '🐉' },
      { labelZh: '查戈斯环礁', labelEn: 'Chagos Atoll', emoji: '🏝️' },
      { labelZh: '马尔代夫泻湖', labelEn: 'Maldives Lagoons', emoji: '🏖️' },
      { labelZh: '桑给巴尔香料镇', labelEn: 'Zanzibar Spice Town', emoji: '🧺' },
      { labelZh: '孙德尔本斯红树林', labelEn: 'Sundarbans Mangroves', emoji: '🌳' },
      { labelZh: '安达曼丛林', labelEn: 'Andaman Jungle', emoji: '🐯' },
    ],
  },
};

export function getVoyageMap(packSlug: string): VoyageMap | null {
  return VOYAGE_MAPS[packSlug] ?? null;
}
```

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/map-boards.test.ts` → PASS. `pnpm typecheck` will still FAIL because `MapBoard.tsx` + the page import the old `getMapBoard` — that's expected; Tasks 3–5 fix it. Do NOT fix those here; just confirm THIS test passes.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/play/map-boards.ts tests/unit/map-boards.test.ts
git commit -m "feat(voyage-board): reshape config to VOYAGE_MAPS (landmark rosters + emoji)"
```

---

## Task 3: `VoyageBoard` component

**Files:** Create `src/components/play/VoyageBoard.tsx`; Test `tests/unit/voyage-board.test.tsx`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/voyage-board.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoyageBoard } from '@/components/play/VoyageBoard';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));

const islands = [
  { weekId: 'w1', completionPercent: 100 },
  { weekId: 'w2', completionPercent: 40 },
];

describe('VoyageBoard', () => {
  it('renders one medallion link per published week with the morph name', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    const links = screen.getAllByTestId('voyage-stop-link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/play/c1/week/w1');
    expect(links[0].style.viewTransitionName).toBe('island-w1');
  });

  it('numbers the stops 1..N', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders locked stops for landmarks beyond the published weeks', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('voyage-stop-locked')).toHaveLength(8); // 10 - 2
  });

  it('flags a cleared (100%) week', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('voyage-stop-cleared')).toHaveLength(1);
  });

  it('renders nothing for an unconfigured pack', () => {
    const { container } = render(<VoyageBoard childId="c1" packSlug="school-custom" islands={islands} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/voyage-board.test.tsx` → FAIL.

- [ ] **Step 3: Implement.** Create `src/components/play/VoyageBoard.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { getVoyageMap } from '@/lib/play/map-boards';
import { voyageLayout } from '@/lib/play/voyage-layout';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

export interface VoyageBoardIsland {
  weekId: string;
  completionPercent: number;
}

interface Props {
  childId: string;
  /** Pack slug — resolved to a config client-side (never pass the config object across RSC). */
  packSlug: string;
  /** Ordered by weekNumber; islands[i] occupies stops[i]. */
  islands: VoyageBoardIsland[];
}

export function VoyageBoard({ childId, packSlug, islands }: Props) {
  const map = getVoyageMap(packSlug);
  const reduced = useReducedMotion();
  if (!map) return null;

  const pos = voyageLayout(map.stops.length);
  const firstActive = islands.findIndex((i) => i.completionPercent < 100);

  return (
    <div
      data-testid="voyage-board"
      className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border-4 border-[#b8895a] bg-[radial-gradient(ellipse_at_center,#3f9aa3_0%,#1f6b73_70%,#16545b_100%)] shadow-lg"
    >
      {/* Parchment frame trim */}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[#e8d6a8]/40" />
      {/* Title banner */}
      <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-[#e8d6a8] px-4 py-1 text-sm font-extrabold text-[#7a4a14] shadow">
        {map.nameZh} · {map.nameEn}
      </div>
      {/* Compass rose */}
      <div className="absolute right-2 top-2 z-10 text-2xl opacity-80" aria-hidden="true">🧭</div>

      {/* Dotted route */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {pos.slice(0, -1).map((a, i) => {
          const b = pos[i + 1];
          return (
            <line
              key={i}
              x1={a.xPct} y1={a.yPct} x2={b.xPct} y2={b.yPct}
              stroke="#e8d6a8" strokeWidth="0.6" strokeDasharray="2 2" strokeLinecap="round"
              opacity="0.8"
            />
          );
        })}
      </svg>

      {/* Stops */}
      {map.stops.map((stop, i) => {
        const island = islands[i];
        const p = pos[i];
        const style = { left: `${p.xPct}%`, top: `${p.yPct}%` } as const;
        const num = i + 1;

        if (!island) {
          return (
            <div
              key={i}
              data-testid="voyage-stop-locked"
              className="absolute flex w-[13%] min-w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={style}
              aria-label={`${stop.labelEn} — locked`}
            >
              <span className="relative flex aspect-square w-full items-center justify-center rounded-full border-4 border-[#8a6a3a] bg-[#cdbb95] text-2xl opacity-60 shadow-inner">
                {stop.emoji}
                <span className="absolute -bottom-1 -right-1 text-base">🔒</span>
              </span>
              <span className="mt-0.5 rounded bg-black/35 px-1 text-[9px] font-semibold leading-tight text-white">
                {stop.labelEn}
              </span>
            </div>
          );
        }

        const cleared = island.completionPercent >= 100;
        const isCurrent = i === firstActive;
        return (
          <Link
            key={i}
            data-testid="voyage-stop-link"
            href={`/play/${childId}/week/${island.weekId}`}
            aria-label={`${stop.labelEn} — week ${num}${cleared ? ' cleared' : isCurrent ? ' current' : ''}`}
            style={{ ...style, viewTransitionName: `island-${island.weekId}` }}
            className="absolute flex w-[13%] min-w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className="relative flex aspect-square w-full items-center justify-center rounded-full border-4 border-[#caa24a] bg-gradient-to-b from-[#fbeec3] to-[#e9c877] text-2xl shadow-md">
              {stop.emoji}
              {/* Gold number badge */}
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#b8232a] text-[11px] font-extrabold text-white shadow">
                {num}
              </span>
              {cleared && (
                <span data-testid="voyage-stop-cleared" className="absolute -bottom-1 -right-1 text-lg" aria-hidden="true">🏴</span>
              )}
              {isCurrent && (
                <span className="absolute -bottom-1 -right-1 text-lg" aria-hidden="true">⛵</span>
              )}
              {isCurrent && !reduced && (
                <span className="absolute inset-0 animate-ping rounded-full bg-[#caa24a]/40" />
              )}
            </span>
            <span className="mt-0.5 rounded bg-black/45 px-1 text-[9px] font-semibold leading-tight text-white">
              {stop.labelEn}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
```

> The exact parchment/medallion styling is implementer craft to refine at the checkpoint; the **structure** (16:9, numbered medallions via `voyageLayout`, route, states, testids) is what the tests pin.

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/voyage-board.test.tsx` → PASS. `pnpm typecheck` → (still red until Tasks 4–5 remove MapBoard; the component itself must compile — verify no errors originate from `VoyageBoard.tsx`).

- [ ] **Step 5: Commit.**

```bash
git add src/components/play/VoyageBoard.tsx tests/unit/voyage-board.test.tsx
git commit -m "feat(voyage-board): VoyageBoard procedural 16:9 treasure-map component"
```

---

## Task 4: Rewire the home page + delete the static-image attempt

**Files:** Modify `src/app/play/[childId]/page.tsx`; Delete `src/components/play/MapBoard.tsx`, `tests/unit/map-board.test.tsx`, `public/maps/caribbean-sea.webp`, `public/maps/indian-ocean.webp`.

- [ ] **Step 1: Delete the superseded files.**

```bash
git rm src/components/play/MapBoard.tsx tests/unit/map-board.test.tsx public/maps/caribbean-sea.webp public/maps/indian-ocean.webp
```

- [ ] **Step 2: Rewire the page.** In `src/app/play/[childId]/page.tsx`:
  - Change the import `import { MapBoard } from '@/components/play/MapBoard';` → `import { VoyageBoard } from '@/components/play/VoyageBoard';`.
  - Change `import { getMapBoard } from '@/lib/play/map-boards';` → `import { getVoyageMap } from '@/lib/play/map-boards';`.
  - Change `const mapBoard = currentMap ? getMapBoard(currentMap.slug) : null;` → `const voyage = currentMap ? getVoyageMap(currentMap.slug) : null;`.
  - In the render ternary, replace the `mapBoard ? <MapBoard …>` branch with:

```tsx
) : voyage ? (
  <VoyageBoard
    childId={childId}
    packSlug={currentMap!.slug}
    islands={islands.map((i) => ({ weekId: i.weekId, completionPercent: i.completionPercent }))}
  />
) : (
```
  (Leave the empty-state branch and the `<IslandMap …>` fallback branch unchanged.)

- [ ] **Step 3: Verify.** `pnpm typecheck` → clean (now that MapBoard/getMapBoard are gone). `pnpm lint` → clean. `pnpm build` → succeeds. Run the full suite: `pnpm test` → green (the deleted `map-board.test.tsx` is gone; `voyage-*` tests pass; IslandMap fallback tests untouched).

- [ ] **Step 4: Commit.**

```bash
git add "src/app/play/[childId]/page.tsx" src/components/play/MapBoard.tsx tests/unit/map-board.test.tsx public/maps
git commit -m "feat(voyage-board): home renders VoyageBoard; remove static-image MapBoard + webp"
```

---

## Task 5: 🛑 STYLING CHECKPOINT — David eyeballs the board

**Human gate. Do NOT do final docs/merge until David approves the look.**

- [ ] **Step 1:** Run the four-green gate so the branch is shippable: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] **Step 2:** Confirm the dev server is running (it was started earlier on this branch). If not: `pnpm dev` (background). Tell David to open **http://localhost:3000/play/33890d7c-c3fb-4214-bb67-8afae76e6ebd** (小板, Caribbean) — the page hot-reloads, so styling tweaks are instant.
- [ ] **Step 3:** Ask David to judge: the 16:9 fill, parchment/ocean feel, medallion + number-badge look, the dotted route, cleared 🏴 / current ⛵ / locked 🔒 states, and whether the landmark labels are readable. Collect his tweaks.
- [ ] **Step 4:** Apply styling adjustments to `VoyageBoard.tsx` (colors, medallion size `w-[13%]`, badge, route stroke, banner/compass, label legibility). Commit each pass (`git commit -m "feat(voyage-board): styling tweaks"`); the dev server hot-reloads. Repeat until David approves. **Only then continue to Task 6.**

> Pure styling — the tests pin structure (testids, links, numbers, counts), so visual tweaks won't break them as long as the testids/text remain.

---

## Task 6: Docs + four-green gate + un-draft PR

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Update CLAUDE.md.** Add a "Current state" entry (voyage board: procedural 16:9 treasure-map home UI replacing the island grid for configured packs; `VOYAGE_MAPS` roster + `voyageLayout` serpentine + `VoyageBoard`; IslandMap fallback; no image, no DB change). Landmines:
  - *Voyage maps are client-only config.* `src/lib/play/map-boards.ts` exports `VOYAGE_MAPS`/`getVoyageMap`; `VoyageBoard` takes a `packSlug: string` and resolves it itself — never pass the config object from a server component.
  - *Stop↔week pairing is positional + auto-laid-out.* `islands[i]` (by weekNumber) occupies `voyageLayout(stops.length)[i]`; stops beyond the published-week count render locked. Adding a pack's voyage = add a `VOYAGE_MAPS[slug]` entry (name + ordered landmark emojis); absence falls back to `IslandMap`. No coordinates — `voyageLayout` positions everything.
  - *The static-image map approach was abandoned* (PR #65 history): the AI map `.png`s remain in `public/maps/` only as design reference; the UI is fully procedural.
  Update the "last refreshed" date.

- [ ] **Step 2: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → all green.

- [ ] **Step 3: Commit + mark ready + retitle PR #65.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record voyage board (procedural treasure-map UI) + landmines"
git push
gh pr ready 65
gh pr edit 65 --title "feat(voyage-board): procedural 16:9 treasure-map home UI"
```

PR body: procedural treasure-map voyage board (16:9, numbered medallions on a winding route, cleared/current/locked states), `IslandMap` fallback, no image/DB/recompile; supersedes the static-image attempt.

---

## Self-review notes (addressed)

- **Spec coverage:** layout → Task 1; config reshape → Task 2; VoyageBoard (medallions/numbers/route/states/reduced-motion/viewTransition) → Task 3; rewire + delete static-image → Task 4; styling checkpoint → Task 5; docs+gate → Task 6. ✓
- **Type consistency:** `VoyagePoint` (Task 1) used by `VoyageBoard` (Task 3); `VoyageStop`/`VoyageMap`/`getVoyageMap` (Task 2) used in Tasks 3–4; `VoyageBoardIsland {weekId, completionPercent}` (Task 3) produced by the Task 4 `islands.map`. ✓
- **Intentional mid-plan red:** Task 2 leaves typecheck red (page/MapBoard still import old exports); Task 4 resolves it by rewire+delete. Called out explicitly so a subagent doesn't "fix" it prematurely. ✓
- **Fallback intact:** `IslandMap` untouched; only the page's middle ternary branch changes. ✓
- **No DB/recompile:** pure config + client component. ✓
