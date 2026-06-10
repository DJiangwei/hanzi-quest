# Landscape 16:9 shell + key surfaces — design

> **Status:** approved scope, pending spec review. First of a 3-PR arc requested by David
> (16:9 shell → home map art → lunar calendar + Monthly Challenge). This PR is the shell.

## Why

The app is played mostly on a **landscape iPad** by Yinuo (6). Today every surface is a
narrow centered phone column (`mx-auto max-w-md`) with a **bottom** tab bar (`KidNavBar`)
and `pb-20` clearance. On a landscape iPad that column floats in the middle of the screen
with large empty side margins — wasted space, small targets, no use of the 16:9 canvas.

This PR makes the app **landscape-native at `lg:` and up** without rebuilding every page:
a side-rail shell + the two surfaces Yinuo actually lives in (home map, scene runner).

## Scope (locked with David)

- **Ambition:** "Shell + key surfaces" — NOT a full per-surface redesign. Other pages
  (shop, backpack, calendar, story, week hub) inherit the side-rail + wider canvas for
  free but are **not** internally re-laid-out in this PR.
- **Home landscape:** **HUD left · Map right** (two-pane).
- **Scene landscape:** **Split — stimulus left · choices right.**
- Out of scope: the AI map illustration (PR-2), lunar calendar (PR-3), any new economy.

## Responsive trigger

Use Tailwind's **`lg:` width breakpoint (≥1024px)** as the single "landscape tablet"
switch. Rationale:
- iPad landscape = 1024–1366px wide → matches `lg:`.
- iPad portrait (768–834) and phones (<500) stay in today's stacked phone layout — correct,
  because portrait *should* stack vertically.
- Width-based, **SSR-safe, no JS orientation probe, no hydration flash — pure CSS**. (A landscape
  phone is short and rare for this app; we deliberately don't special-case it.)

No `useEffect`/`matchMedia` — everything is Tailwind responsive classes so it renders right
on the server and never flashes.

## Components & responsibilities

### 1. `KidNavBar` → dual render (bottom bar + side rail)

**File:** `src/components/play/KidNavBar.tsx` (modify)

Today: one bottom `<nav>` (`sticky bottom-0 flex justify-around`). Change to render **two**
navs from the same `tabs` array, toggled purely by responsive visibility:

- **Bottom bar** (phones/portrait): existing markup, gains `lg:hidden`.
- **Side rail** (`lg:`): `hidden lg:flex`, `fixed left-0 top-0 bottom-0 w-20 flex-col`,
  vertical stack of the 5 tabs (icon over label, same active-dot treatment) + the ⚙️ gear
  pinned to the bottom. Same `onTabClick` mid-scene quit-confirm logic (shared handler —
  do NOT duplicate the dialog; lift `tabs`, `onTabClick`, and `<QuitConfirmDialog>` so both
  navs reuse them).

Both navs sit inside the existing `<>` fragment; the single `confirmTarget` state and
`QuitConfirmDialog` already live there and are reused unchanged.

The rail is **fixed** (not in flow) so it overlays the left edge; the layout reserves space
for it via padding (next item). Bilingual labels stay (`地图 / Map` …) per the bilingual rule.

### 2. `play/layout.tsx` → reserve rail space

**File:** `src/app/play/[childId]/layout.tsx` (modify)

The content wrapper currently has `pb-20` (bottom-bar clearance). Make it responsive:
`pb-20 lg:pb-0 lg:pl-20` — drop the bottom padding and inset the content by the rail width
at `lg:`. The top `<header>` (title + ShopHudButton) also gets `lg:pl-20` so it clears the
rail. Nothing else in the layout changes; `KidNavBar` handles which nav shows.

### 3. Home page → two-pane (HUD left · Map right)

**File:** `src/app/play/[childId]/page.tsx` (modify, JSX only — no data changes)

Today the `<main>` is `mx-auto max-w-md flex-col gap-5`. Restructure the **return** into:

- **Phones (default):** unchanged vertical stack (avatar header → MapHeaderPill → WeekStrip →
  DailyQuests → LatestChapterPill → map). Visual parity with today.
- **`lg:` two-pane:** `lg:grid lg:grid-cols-[minmax(300px,360px)_1fr] lg:gap-6 lg:max-w-none`.
  - **Left HUD column:** avatar+pet+coins header, `MapHeaderPill`, `WeekStrip`,
    `DailyQuestsPanel`, `LatestChapterPill` — stacked, scrollable.
  - **Right map pane:** the `VoyageBoard` / `IslandMap` (the empty-state card too), in a
    container that fills the pane height and scrolls internally. **Default (per the
    risks section): the page body scrolls and panes size to content** — i.e. no inner
    `overflow-y-auto` / bounded-height gymnastics in this PR; the map pane simply occupies
    the right grid cell and the whole page scrolls if it overflows. The board itself is
    unchanged in this PR — PR-2 replaces its art.

Implementation note: wrap the HUD children in one `<div>` and the map in another, then apply
the grid on the parent at `lg:`. On phones the grid collapses (block flow) so order is
preserved. Keep all existing props/data fetching exactly as-is.

### 4. Scene split — `MultipleChoiceQuiz` (covers most scenes)

**File:** `src/components/scenes/MultipleChoiceQuiz.tsx` (modify)

Today: `<div class="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">` with
`prompt`, `stimulus`, then a `grid grid-cols-2 max-w-md` of choices — a single centered column.

At `lg:`, become a **two-pane split**:
- Outer: `lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-12`.
- **Left pane:** `prompt` + `stimulus` (centered in its half).
- **Right pane:** the choices grid; widen its cap (`lg:max-w-lg`) so buttons are bigger.

Phones keep the exact current single-column flow (the `lg:` classes are additive). This one
change lights up **AudioPick, ImagePick, ImageWord, TranslatePick, SentenceCloze** (all
delegate here). Retired scenes (PinyinPick/VisualPick/WordMatch) also inherit it harmlessly.

### 5. Standalone scenes — size up (no split)

- **`FlashcardScene`** — already a centered card; at `lg:` allow a larger card + place the
  example word/sentence reveal rows beside it is out of scope — just bump max sizing so it
  doesn't look tiny on iPad (`lg:` width/scale on the card container). Keep centered.
- **`LianliankanScene`** — board is centered; the tile `clamp()` already scales. Add
  `lg:` breathing room (max-width bump) so it centers nicely in the wide canvas. No layout
  rebuild.
- **`BossScene`** — keep its own layout; just ensure it isn't capped to `max-w-md` on `lg:`
  (widen container). Boss split is out of scope.
- **`SceneRunner`** top bar (`weekLabel`, count, coins) already spans full width — no change.

## Testing

All tests mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation` (no real DB/net).

- **`KidNavBar`** (`tests/unit/...`): renders both navs; side rail has the same 5 tabs + gear;
  mid-scene tab click still opens the quit-confirm dialog (shared handler). Assert the rail
  exists (e.g. an element with the rail's test id / `aria-label`) and that bottom bar still
  renders. jsdom can't evaluate media queries, so we assert **both** navs are in the DOM and
  carry the right responsive classes (className contains `lg:hidden` / `lg:flex`) rather than
  computed visibility.
- **Home page**: a render test asserting the HUD wrapper and map wrapper both exist and the
  grid class is present on the `lg:` container (className assertion).
- **`MultipleChoiceQuiz`**: existing tests must stay green; add one asserting the split-grid
  class is present and that `prompt`/`stimulus`/choices all still render.
- **No regression**: full suite green; the four-green gate
  (`pnpm typecheck && lint && test && build`) is the bar.

## Risks / landmines

- **jsdom has no layout/media-query engine** — tests assert presence + class strings, not
  pixel layout. Visual correctness verified manually in `pnpm dev` at an iPad-landscape
  viewport (1024–1366px).
- **Fixed rail + scroll**: the rail is `fixed`; ensure the content's `lg:pl-20` exactly
  matches the rail `w-20` so nothing is occluded. Internal map-pane scroll must not create a
  double scrollbar — give the pane a bounded height and `overflow-y-auto`, let the page body
  not scroll at `lg:` (or let it; pick one and be consistent — default: page scrolls, panes
  size to content, simplest).
- **Bilingual rule** stays in force — every nav label remains `中文 / English`; the
  `bilingual-chrome` regression test must stay green.
- **No new deps, no DB migration, no recompile.** Pure layout/CSS + component JSX.

## Verification checklist (manual, `pnpm dev`)

1. Phone viewport (390px): bottom bar present, pages stack exactly as today (visual parity).
2. iPad-landscape viewport (1180px): left rail present, bottom bar gone, content inset by rail.
3. Home at 1180px: HUD column left, map fills right pane.
4. Play a meaning scene at 1180px: stimulus left, choices right, big targets.
5. Mid-scene, tap a rail tab → quit-confirm dialog appears (rail reuses the handler).
6. Reduced-motion still respected on the map ping / scene fx (unchanged).
