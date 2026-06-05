# Illustrated Map UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the procedural island map with David's two illustrated treasure maps, placing a tappable hotspot over each week's landmark, while keeping `IslandMap` as a fallback for unconfigured packs.

**Architecture:** A pure client-safe `map-boards.ts` config (keyed by pack slug) holds per-week hotspot %-coordinates. A `MapBoard` client component overlays absolutely-positioned hotspot links on a `next/image` map background. The home page chooses `MapBoard` when the current pack has a config, else `IslandMap`. Coords are estimated then fine-tuned on a preview checkpoint.

**Tech Stack:** Next.js 16 App Router, React 19, `next/image`, Tailwind, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-05-illustrated-map-ui-design.md`
**Branch:** `feat/illustrated-map-ui` (spec + source PNGs already committed).

---

## Key existing shapes (read before starting)

- Home page `src/app/play/[childId]/page.tsx`:
  - `const maps = await listMapsForChild(child.id)`; `const currentMap = maps.find((m) => m.isCurrent) ?? null;` — `currentMap` has a **`slug: string`** (and `nameZh`/`nameEn`/`isCurrent`).
  - `const islands = playableWeeks.map((w) => ({ weekId, weekNumber, label, completionPercent }))` — ordered by weekNumber.
  - Renders, around line 153–174:
    ```tsx
    {islands.length === 0 ? (<div>…No islands yet…</div>) : (
      <IslandMap childId={childId} islands={islands} ownedCount={ownedCount} totalCount={totalCount} decorations={ownedDecorations.map((d) => ({ slug: d.slug }))} />
    )}
    ```
- `IslandMap` (`src/components/play/IslandMap.tsx`) — `IslandInput = { weekId, weekNumber, label, completionPercent }`. Each island links to `/play/${childId}/week/${weekId}` with `style={{ viewTransitionName: \`island-${weekId}\` }}`. **Leave this file untouched** (it's the fallback).
- `useReducedMotion()` from `@/lib/hooks/use-reduced-motion`.
- Vitest mocks: `next/navigation` and `next/image` must be mocked in component tests (a `next/image` mock renders a plain `<img>`).

---

## File structure

**New**
- `public/maps/caribbean-sea.webp`, `public/maps/indian-ocean.webp` — optimized backgrounds (source `.png`s already committed).
- `src/lib/play/map-boards.ts` — config + `getMapBoard`.
- `src/components/play/MapBoard.tsx` — the overlay component.
- `tests/unit/map-boards.test.ts`, `tests/unit/map-board.test.tsx`.

**Modified**
- `src/app/play/[childId]/page.tsx` — the MapBoard/IslandMap chooser.
- `CLAUDE.md` — PR entry + landmine.

---

## Task 1: Convert maps to WebP

**Files:** Create `public/maps/caribbean-sea.webp`, `public/maps/indian-ocean.webp`.

- [ ] **Step 1: Convert both PNGs to WebP.** Use macOS `sips` (supports webp):

```bash
sips -s format webp public/maps/caribbean-sea.png --out public/maps/caribbean-sea.webp
sips -s format webp public/maps/indian-ocean.png --out public/maps/indian-ocean.webp
```

If `sips` fails on webp, fallback to `cwebp -q 80 in.png -o out.webp` (Homebrew `webp`), or a one-off node script using `sharp` if installed. The goal: two `.webp` files.

- [ ] **Step 2: Verify size + dimensions.**

```bash
for f in public/maps/*.webp; do echo "$f"; sips -g pixelWidth -g pixelHeight "$f" | grep pixel; du -h "$f" | cut -f1; done
```
Expected: 2048×2048, each well under 2MB (ideally <800KB). If a file is still >1.5MB, re-run with lower quality (`sips` re-encode or `cwebp -q 70`).

- [ ] **Step 3: Commit.**

```bash
git add public/maps/caribbean-sea.webp public/maps/indian-ocean.webp
git commit -m "feat(illustrated-map): WebP-optimized map backgrounds"
```

---

## Task 2: `map-boards.ts` config + `getMapBoard`

**Files:** Create `src/lib/play/map-boards.ts`; Test `tests/unit/map-boards.test.ts`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/map-boards.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAP_BOARDS, getMapBoard } from '@/lib/play/map-boards';

describe('map-boards config', () => {
  it('has Caribbean (10 hotspots) and Indian Ocean (9 hotspots)', () => {
    expect(getMapBoard('pirate-class-level-1')?.hotspots).toHaveLength(10);
    expect(getMapBoard('pirate-class-level-2')?.hotspots).toHaveLength(9);
  });

  it('returns null for unconfigured packs', () => {
    expect(getMapBoard('school-custom')).toBeNull();
    expect(getMapBoard('nope')).toBeNull();
  });

  it('every hotspot has in-range coords and bilingual labels', () => {
    for (const cfg of Object.values(MAP_BOARDS)) {
      expect(cfg.imageSrc).toMatch(/^\/maps\/.+\.webp$/);
      expect(cfg.nameZh).toBeTruthy();
      expect(cfg.nameEn).toBeTruthy();
      for (const h of cfg.hotspots) {
        expect(h.xPct).toBeGreaterThanOrEqual(0);
        expect(h.xPct).toBeLessThanOrEqual(100);
        expect(h.yPct).toBeGreaterThanOrEqual(0);
        expect(h.yPct).toBeLessThanOrEqual(100);
        expect(h.labelZh).toBeTruthy();
        expect(h.labelEn).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/map-boards.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Create `src/lib/play/map-boards.ts`:

```ts
export interface MapHotspot {
  /** Center X as % of image width (0–100). */
  xPct: number;
  /** Center Y as % of image height (0–100). */
  yPct: number;
  /** Landmark scenery name (display only — weeks teach hanzi, not geography). */
  labelZh: string;
  labelEn: string;
}

export interface MapBoardConfig {
  imageSrc: string;
  nameZh: string;
  nameEn: string;
  /** Ordered to match weekNumber: hotspots[0] = week 1. */
  hotspots: MapHotspot[];
}

/** Keyed by curriculum pack slug. Packs absent here fall back to <IslandMap>. */
export const MAP_BOARDS: Record<string, MapBoardConfig> = {
  'pirate-class-level-1': {
    imageSrc: '/maps/caribbean-sea.webp',
    nameZh: '加勒比海',
    nameEn: 'Caribbean Sea',
    hotspots: [
      { xPct: 20, yPct: 33, labelZh: '旧哈瓦那', labelEn: 'Old Havana' },
      { xPct: 50, yPct: 27, labelZh: '大蓝洞', labelEn: 'Great Blue Hole' },
      { xPct: 80, yPct: 28, labelZh: '伯利兹群岛度假村', labelEn: 'Belize Cayes Resort' },
      { xPct: 83, yPct: 56, labelZh: '图卢姆玛雅遗址', labelEn: 'Tulum Mayan Ruins' },
      { xPct: 50, yPct: 49, labelZh: '黄貂鱼城', labelEn: 'Stingray City' },
      { xPct: 22, yPct: 55, labelZh: '蓝山瀑布', labelEn: 'Blue Mountains Waterfall' },
      { xPct: 20, yPct: 72, labelZh: '托尔图盖罗海龟海滩', labelEn: 'Tortuguero Turtle Beach' },
      { xPct: 17, yPct: 87, labelZh: '哥斯达黎加丛林', labelEn: 'Costa Rican Jungle' },
      { xPct: 50, yPct: 84, labelZh: '皮通山', labelEn: 'The Pitons' },
      { xPct: 80, yPct: 84, labelZh: '托尔图加岛海盗巢穴', labelEn: "Tortuga Pirate's Lair" },
    ],
  },
  'pirate-class-level-2': {
    imageSrc: '/maps/indian-ocean.webp',
    nameZh: '印度洋',
    nameEn: 'Indian Ocean',
    hotspots: [
      { xPct: 17, yPct: 35, labelZh: '毛里求斯瀑布', labelEn: 'Mauritius Waterfall' },
      { xPct: 45, yPct: 28, labelZh: '留尼汪海龟海滩', labelEn: 'Réunion Turtle Beach' },
      { xPct: 75, yPct: 27, labelZh: '马斯喀特苏丹王宫', labelEn: "Muscat Sultan's Palace" },
      { xPct: 80, yPct: 55, labelZh: '塞舌尔花岗岩兽穴', labelEn: 'Seychelles Granites Lair' },
      { xPct: 47, yPct: 52, labelZh: '查戈斯环礁', labelEn: 'Chagos Atoll' },
      { xPct: 20, yPct: 60, labelZh: '马尔代夫泻湖', labelEn: 'Maldives Lagoons' },
      { xPct: 17, yPct: 78, labelZh: '桑给巴尔香料镇', labelEn: 'Zanzibar Spice Town' },
      { xPct: 48, yPct: 82, labelZh: '孙德尔本斯红树林', labelEn: 'Sundarbans Mangroves' },
      { xPct: 78, yPct: 80, labelZh: '安达曼丛林', labelEn: 'Andaman Jungle' },
    ],
  },
};

export function getMapBoard(packSlug: string): MapBoardConfig | null {
  return MAP_BOARDS[packSlug] ?? null;
}
```

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/map-boards.test.ts` → PASS. `pnpm typecheck` → clean.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/play/map-boards.ts tests/unit/map-boards.test.ts
git commit -m "feat(illustrated-map): MAP_BOARDS config + getMapBoard"
```

---

## Task 3: `MapBoard` component

**Files:** Create `src/components/play/MapBoard.tsx`; Test `tests/unit/map-board.test.tsx`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/map-board.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapBoard } from '@/components/play/MapBoard';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as object)} />;
  },
}));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));

const islands = [
  { weekId: 'w1', completionPercent: 100 },
  { weekId: 'w2', completionPercent: 40 },
];

describe('MapBoard', () => {
  it('renders one hotspot link per published week with the morph name', () => {
    render(<MapBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    const links = screen.getAllByTestId('map-hotspot-link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/play/c1/week/w1');
    expect(links[0].style.viewTransitionName).toBe('island-w1');
  });

  it('renders locked badges for landmarks beyond the published weeks', () => {
    render(<MapBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    // Caribbean has 10 hotspots, 2 published → 8 locked
    expect(screen.getAllByTestId('map-hotspot-locked')).toHaveLength(8);
  });

  it('flags a cleared (100%) week', () => {
    render(<MapBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('map-hotspot-cleared')).toHaveLength(1);
  });

  it('renders nothing for an unconfigured pack', () => {
    const { container } = render(<MapBoard childId="c1" packSlug="school-custom" islands={islands} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/map-board.test.tsx` → FAIL (component missing).

- [ ] **Step 3: Implement.** Create `src/components/play/MapBoard.tsx`:

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getMapBoard } from '@/lib/play/map-boards';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

export interface MapBoardIsland {
  weekId: string;
  completionPercent: number;
}

interface Props {
  childId: string;
  /** Pack slug — resolved to a config client-side (never pass the config object across RSC). */
  packSlug: string;
  /** Ordered by weekNumber; islands[i] occupies hotspots[i]. */
  islands: MapBoardIsland[];
}

export function MapBoard({ childId, packSlug, islands }: Props) {
  const board = getMapBoard(packSlug);
  const reduced = useReducedMotion();
  if (!board) return null;

  const firstActive = islands.findIndex((i) => i.completionPercent < 100);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-2xl shadow-md">
      <Image
        src={board.imageSrc}
        alt={`${board.nameZh} / ${board.nameEn}`}
        fill
        priority
        sizes="(max-width: 768px) 100vw, 672px"
        className="object-cover"
      />
      {board.hotspots.map((h, i) => {
        const island = islands[i];
        const style = { left: `${h.xPct}%`, top: `${h.yPct}%` } as const;
        if (!island) {
          // Future landmark — locked, non-interactive.
          return (
            <div
              key={i}
              data-testid="map-hotspot-locked"
              className="absolute flex h-[14%] min-h-11 w-[14%] min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={style}
              aria-label={`${h.labelEn} — locked`}
            >
              <span className="rounded-full bg-black/45 px-1.5 py-0.5 text-base leading-none">🔒</span>
            </div>
          );
        }
        const cleared = island.completionPercent >= 100;
        const isCurrent = i === firstActive;
        return (
          <Link
            key={i}
            data-testid="map-hotspot-link"
            href={`/play/${childId}/week/${island.weekId}`}
            aria-label={`${h.labelEn} — week ${i + 1}`}
            style={{ ...style, viewTransitionName: `island-${island.weekId}` }}
            className="absolute flex h-[14%] min-h-11 w-[14%] min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {/* current-week pulse ring (reduced-motion off) */}
            {isCurrent && !reduced && (
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-treasure-400)]/40" />
            )}
            {isCurrent && (
              <span className="absolute inset-0 rounded-full ring-2 ring-[var(--color-treasure-400)]" />
            )}
            {cleared && (
              <span
                data-testid="map-hotspot-cleared"
                className="absolute -right-1 -top-1 text-lg drop-shadow"
                aria-hidden="true"
              >
                🏴
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
```

> Note the `data-testid="map-hotspot-cleared"` is nested inside the cleared link; the test counts it via `getAllByTestId`. The locked branch and the link branch are mutually exclusive per index.

- [ ] **Step 4: Run green.** `pnpm vitest run tests/unit/map-board.test.tsx` → PASS. `pnpm typecheck` → clean, `pnpm lint` → clean (the `next/image` eslint rule is satisfied since we use the real `Image` in the component; the test's `<img>` mock has inline disables).

- [ ] **Step 5: Commit.**

```bash
git add src/components/play/MapBoard.tsx tests/unit/map-board.test.tsx
git commit -m "feat(illustrated-map): MapBoard hotspot-overlay component"
```

---

## Task 4: Wire the home page chooser

**Files:** Modify `src/app/play/[childId]/page.tsx`.

- [ ] **Step 1: Import + choose.** In `src/app/play/[childId]/page.tsx`:
  - Add imports: `import { MapBoard } from '@/components/play/MapBoard';` and `import { getMapBoard } from '@/lib/play/map-boards';`.
  - After `currentMap` is computed, add: `const mapBoard = currentMap ? getMapBoard(currentMap.slug) : null;`.
  - Replace the islands render branch:

```tsx
{islands.length === 0 ? (
  <div className="rounded-2xl border-2 border-dashed border-[var(--color-sunset-400)] bg-white/70 p-8 text-center text-sm text-[var(--color-sand-900)]">
    <p className="font-semibold">No islands yet, captain.</p>
    <p className="mt-1 text-[var(--color-sand-700)]">
      A parent needs to publish a week first. Visit{' '}
      <Link href="/parent/stage/new" className="font-semibold text-[var(--color-ocean-700)] underline">parent dashboard</Link>.
    </p>
  </div>
) : mapBoard ? (
  <MapBoard
    childId={childId}
    packSlug={currentMap!.slug}
    islands={islands.map((i) => ({ weekId: i.weekId, completionPercent: i.completionPercent }))}
  />
) : (
  <IslandMap
    childId={childId}
    islands={islands}
    ownedCount={ownedCount}
    totalCount={totalCount}
    decorations={ownedDecorations.map((d) => ({ slug: d.slug }))}
  />
)}
```

  (Keep the exact empty-state markup that's already there — only the non-empty branch changes from always-`IslandMap` to `mapBoard ? MapBoard : IslandMap`.)

- [ ] **Step 2: Verify.** `pnpm typecheck` → clean. `pnpm lint` → clean. Run the home-page test if one exists: `pnpm vitest run $(grep -rl "play/\[childId\]/page\|HomePage\|island" tests/unit 2>/dev/null | head -1)` — if no direct page test, skip (the chooser is exercised by typecheck + the component tests).

- [ ] **Step 3: Build (confirms `next/image` + the public asset path resolve).** `pnpm build` → succeeds.

- [ ] **Step 4: Commit.**

```bash
git add "src/app/play/[childId]/page.tsx"
git commit -m "feat(illustrated-map): home page renders MapBoard when the pack has one, else IslandMap"
```

---

## Task 5: 🛑 PREVIEW CHECKPOINT — David fine-tunes hotspot coordinates

**Human gate. Do NOT do the final docs/merge until David approves the coordinates.**

- [ ] **Step 1:** Run the four-green gate so the branch is deployable: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] **Step 2:** Push the branch and open a **draft** PR so Vercel builds a preview:

```bash
git push -u origin feat/illustrated-map-ui
gh pr create --draft --title "feat(illustrated-map): illustrated treasure-map home UI [WIP — coord tuning]" --base main --body "Draft for coordinate tuning. MapBoard renders the Caribbean illustration with 10 week hotspots; Indian Ocean shows 9 locked stops. Estimated coords in src/lib/play/map-boards.ts need a preview pass."
```

- [ ] **Step 3:** Give David the preview branch URL and ask him to check, on Caribbean, that each of the 10 hotspots sits on its landmark (and the pulse marks the current week, flags on cleared). Collect his nudges.
- [ ] **Step 4:** Apply coordinate adjustments by editing the `xPct`/`yPct` values in `src/lib/play/map-boards.ts` (the `map-boards.test.ts` range test still guards them). Commit each tuning pass (`git commit -m "feat(illustrated-map): tune hotspot coords"`), push, let the preview rebuild, repeat until David approves. **Only then continue to Task 6.**

> Tap targets are ~14% wide, so coords only need to be within a few percent. Indian Ocean has no published weeks, so its hotspots show as locked badges — its coords can be tuned later when weeks are authored (note this to David; getting Caribbean right is the priority).

---

## Task 6: Docs + four-green gate + un-draft PR

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Update CLAUDE.md.** Add a "Current state" PR entry (illustrated map UI: `MAP_BOARDS` config + `MapBoard` overlay; Caribbean/Indian Ocean WebP backgrounds; per-week %-hotspots; `IslandMap` kept as fallback; decor not shown on illustrated maps; no DB change). Add landmines:
  - *Map boards are client-only config.* `src/lib/play/map-boards.ts` is pure; `MapBoard` takes a `packSlug: string` and calls `getMapBoard` itself — never pass the config object from a server component (PackUiMeta-style RSC hazard).
  - *Hotspot coords are %-based and hand-tuned.* `(xPct,yPct)` are centers as % of the square image; adjust by editing `map-boards.ts` + checking the preview. Adding a pack's map = add a `MAP_BOARDS[slug]` entry + a `.webp` under `public/maps/`; absence falls back to `IslandMap`.
  - *Decorations are not rendered on illustrated maps* (v1 cut) — they still render on `IslandMap`-fallback packs.
  - *Hotspot↔week pairing is positional* — `islands[i]` (ordered by weekNumber) occupies `hotspots[i]`; landmarks beyond the published-week count show as locked.
  Update the "last refreshed" date.

- [ ] **Step 2: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → all green.

- [ ] **Step 3: Commit + mark ready.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record illustrated map UI + landmines"
git push
gh pr ready <PR#>
gh pr edit <PR#> --title "feat(illustrated-map): illustrated treasure-map home UI"
```

PR body: illustrated Caribbean/Indian Ocean maps as the home UI, per-week hotspots (cleared flag / current pulse / locked future stops), `IslandMap` fallback, WebP backgrounds, no DB change/recompile.

---

## Self-review notes (addressed)

- **Spec coverage:** WebP → Task 1; config+getMapBoard → Task 2; MapBoard (hotspots/cleared/current/locked/reduced-motion/viewTransition) → Task 3; chooser wiring → Task 4; preview coord checkpoint → Task 5; docs+gate → Task 6. ✓
- **Type consistency:** `MapHotspot`/`MapBoardConfig`/`getMapBoard` defined Task 2, used in Tasks 3–4; `MapBoardIsland {weekId, completionPercent}` defined Task 3, produced by the Task 4 `islands.map`. `currentMap.slug` confirmed present on `MapForChild`. ✓
- **Fallback intact:** `IslandMap` untouched; only the page's non-empty branch becomes a ternary. ✓
- **No DB/recompile:** pure config + client component + a static asset. ✓
- **`next/image` in tests:** mocked to a plain `<img>` so jsdom renders; the real component uses `Image` (satisfies the `@next/next/no-img-element` lint in app code). ✓
