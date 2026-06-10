# Home map art — landscape-fit illustrated voyage board

> **Status:** approved scope. PR-2 of the 3-PR arc (16:9 shell ✓ → **home map art** → lunar
> calendar + Monthly Challenge). Builds on the landscape shell (PR #77).

## Why

The home "voyage board" is 100% hand-CSS (parchment gradient + emoji medallions) and is a
**tall vertical-scroll** zigzag. On the new landscape iPad shell the map sits in a right pane
where a tall scroll feels wrong. David wants it **enlarged + enriched**: a real illustrated
sea-chart that fits the landscape pane with **no scroll**, plus an **animated sailing ship**
tracing the route.

## Decisions (locked with David)

- **Shape:** landscape-fit map (no scroll) on `lg:`; phones keep a compact vertical board.
- **Enrichment:** **both** — an AI-illustrated backdrop **and** animated SVG overlays (a ship
  sailing the route + gentle motion).
- **Backdrop pattern:** the AI **cannot** align a path to our medallions, so flux generates a
  **decorative sea-chart backdrop only** (parchment, ocean, small islands, compass rose, a
  friendly sea monster, waves — **no text, no path, no numbers**); we overlay the route +
  numbered stops + ship procedurally. Same separation as word-images → `ImageWordScene`.

## Graceful degradation (critical)

The illustrated flux backdrop requires a Cloudflare token + neuron budget that aren't
available at build time. So **the code must ship and look good without the images**:

- `VoyageMap` gains an **optional** `imageUrl?: string`.
- When `imageUrl` is set → render it as an `object-cover` backdrop.
- When absent → render a **richer procedural sea-chart backdrop** (decorative SVG: parchment,
  sea texture, a compass rose, small islands, a sea-monster silhouette) — strictly better than
  today's flat gradient, and good enough to ship before any flux image exists.

Wiring the 2 flux images is a **post-merge op** (needs a fresh `CF_API_TOKEN`): run the
generator, paste the 2 Blob URLs into `VOYAGE_MAPS[...].imageUrl`. No code change beyond the
two string literals; the backdrop swaps automatically.

## Responsive layout switch

Positions are JS-computed `{xPct,yPct}` (not CSS), so we can't switch layouts by media query
alone. Use the **blessed `useSyncExternalStore` matchMedia pattern** (CLAUDE.md: the React-19
SSR-safe client-detection idiom, same as PR #48/#50):

- New hook `useIsWide()` (`src/lib/hooks/use-is-wide.ts`): `useSyncExternalStore` over
  `matchMedia('(min-width: 1024px)')`. `getServerSnapshot` → `false` (SSR renders the phone
  board; hydrates to landscape on iPad — a post-hydration state change, **not** a mismatch).
- `VoyageBoard` picks the layout + container styling from `useIsWide()`. **One board rendered**
  (no DOM duplication).

## Components & responsibilities

### 1. `voyageLayoutHorizontal(total)` — new landscape layout

**File:** `src/lib/play/voyage-layout.ts` (add alongside existing `voyageLayout`)

A **boustrophedon (snake) over a wide board**: split `total` stops into 2 rows; row 0 runs
left→right across the top third, row 1 runs right→left across the bottom third, so the route
reads as a continuous winding path. Returns `VoyagePoint[]` (`{xPct,yPct}`) over a 16:9-ish
board. Pure function, fully unit-tested (count, monotonic x within a row, row split, endpoints
within 0–100). Keep `voyageLayout` (vertical) unchanged for phones.

### 2. `useIsWide()` hook

**File:** `src/lib/hooks/use-is-wide.ts` (new). `useSyncExternalStore(subscribe, () =>
matchMedia('(min-width:1024px)').matches, () => false)`. Client-only; `'use client'` consumers
only. Guard `typeof window === 'undefined'` in subscribe.

### 3. Procedural backdrop — `VoyageBackdrop`

**File:** `src/components/play/VoyageBackdrop.tsx` (new, `'use client'` or pure)

Renders the sea-chart backdrop for a board:
- If `imageUrl` → `<img class="absolute inset-0 h-full w-full object-cover" loading="lazy">`.
- Else → a **decorative procedural layer**: parchment gradient + sea waves (reuse the existing
  data-URI wave SVGs from `VoyageBoard`) + an inline SVG of a **compass rose**, 2–3 small
  **islands**, and a faint **sea-monster** silhouette. No interactivity. `aria-hidden`.

Extract the existing `PARCHMENT_BG` / `SEA_WAVES` / wave-band constants from `VoyageBoard` into
this component (or a shared `voyage-textures.ts`) so both the phone board and the landscape
board share them.

### 4. `SailingShip` — animated overlay

**File:** `src/components/play/SailingShip.tsx` (new, `'use client'`)

A small ship (inline SVG, ~32–40px) that **sails the route** on a slow loop using framer-motion:
animate `left`/`top` (%) through the ordered stop points (the same `pos` array), easing between
legs, looping (~`14s`), with a gentle bob/rotate. **Reduced-motion** (`useReducedMotion()`) →
static ship parked at the current stop (first incomplete), no animation. Props: `points:
VoyagePoint[]`, `currentIndex: number`.

### 5. `VoyageBoard` — wire it together

**File:** `src/components/play/VoyageBoard.tsx` (modify)

- Compute `wide = useIsWide()`. Pick `points = wide ? voyageLayoutHorizontal(n) :
  voyageLayout(n)`.
- **Landscape (`wide`):** container is **aspect-fit, no scroll** — `w-full` with an
  `aspect-[16/10]` (approx) board, `max-h-[calc(100vh-...)]` so it fits the pane; `<VoyageBackdrop>`
  fills it; route SVG + stops absolutely positioned via `points`; `<SailingShip>` overlaid.
  Stops shrink a touch for the denser landscape layout.
- **Phone (`!wide`):** existing tall vertical board (`height = n × STOP_GAP_PX`, scrolls),
  now using `<VoyageBackdrop>` for its sea panel + an optional `<SailingShip>`. Visual parity
  otherwise.
- Keep `packSlug → getVoyageMap` resolution client-side (the RSC-safe landmine). `imageUrl`
  comes from the resolved `map.imageUrl`.

### 6. `map-boards.ts` — optional image field + generator hookup

**File:** `src/lib/play/map-boards.ts` (modify): add `imageUrl?: string` to `VoyageMap`
(undefined for both maps until generated). No DB, no migration — stays client-only config per
the existing landmine.

### 7. `scripts/generate-voyage-map-art.ts` — flux generator (ready, run post-token)

**File:** new script mirroring `scripts/generate-collectible-art-cloudflare.ts`:
`loadEnv()` → dynamic imports inside `main()` → for each voyage pack slug, flux prompt
("a colorful cartoon pirate treasure map sea chart for children, parchment, blue ocean, small
tropical islands, a compass rose, a friendly sea monster, gentle waves, NO text, NO path, NO
numbers, top-down map view"), `put('maps/{slug}.jpg', ...)` (public, no random suffix,
overwrite), and **print the URL** to paste into `map-boards.ts`. CF creds from
`CF_ACCOUNT_ID`/`CF_API_TOKEN` env (never committed). ~2 generations — well within the daily
neuron budget.

## Testing

All mock external boundaries; no real DB/net.

- **`voyageLayoutHorizontal`** (`tests/unit/voyage-layout-horizontal.test.ts`): correct count;
  2-row split; x increases across row 0 and decreases across row 1; all points 0–100;
  `total<=0 → []`; odd counts handled.
- **`useIsWide`**: render a probe component; assert it returns `false` under jsdom default
  (no matchMedia match) — i.e. SSR/phone path is the safe default. (jsdom has no real
  matchMedia; stub it to assert both branches if feasible, else assert the server-snapshot
  default.)
- **`VoyageBackdrop`**: renders `<img>` when `imageUrl` set; renders the procedural SVG layer
  (no `<img>`) when absent.
- **`SailingShip`**: renders the ship; with reduced-motion mocked `true`, no animation wrapper
  jank — assert it still renders the ship at the current stop (presence assertion; framer
  internals not asserted).
- **`VoyageBoard`**: existing tests stay green; add one asserting it renders stops for both the
  default (phone) path and that the landscape container class appears when `useIsWide` is
  stubbed `true` (mock the hook).

Four-green gate (`pnpm typecheck && lint && test && build`) is the bar.

## Risks / landmines

- **flux is fixed 1024²** on CF (the `{prompt, steps}` call) — the backdrop is a square image
  used `object-cover`; it will crop top/bottom in the landscape pane. Acceptable for a
  decorative backdrop. Don't pass width/height expecting a wide image.
- **Hydration:** `useIsWide` server-snapshot is `false` → iPad briefly shows the phone board
  for one frame before hydrating to landscape. This is a state change, not a mismatch (no React
  warning). Acceptable; documented.
- **No flux token at build** → ship with `imageUrl` undefined; the procedural backdrop renders.
  The PR is fully functional and tested without any image. Generating + wiring the 2 URLs is a
  post-merge op gated on a fresh `CF_API_TOKEN`.
- **Reduced-motion** must fully disable the ship's loop (parked static).
- **No DB migration, no recompile, no new runtime deps** (framer-motion already present from the
  boss animations PR #64).
- **Voyage maps stay client-only config** — `VoyageBoard` resolves `packSlug` itself; never pass
  the config object across an RSC boundary.

## Verification (manual, `pnpm dev`)

1. Phone (390px): vertical scroll board as before, now with the richer procedural backdrop +
   (optional) parked ship. Visual parity-or-better.
2. iPad landscape (1180px): map fits the right pane with **no vertical scroll**; stops wind
   L→R then R→L; ship sails the route on a loop.
3. Reduced-motion on: ship parked, no looping.
4. Set a fake `imageUrl` on one map → the procedural backdrop is replaced by the `<img>`.
