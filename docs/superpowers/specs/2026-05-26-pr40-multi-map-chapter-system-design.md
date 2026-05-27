# PR #40 — Multi-Map Chapter System (design spec)

> Date: 2026-05-26
> Status: design approved, plan pending
> Predecessor: PR #38 (kid-first surface refresh)
> Companion-deferred: PR #39-eq (Gemini image backfill — blocked on Gemini billing enable)

## 1. Goal

Treat the existing 10-week `pirate-class-level-1` curriculum as **Map 1: 加勒比海 / Caribbean Sea** of a larger nautical chart. Add architectural support for additional maps and ship a visible-but-locked placeholder for **Map 2: 印度洋 / Indian Ocean** so Yinuo sees the bigger arc from day one. The work is mostly metadata + a new `/maps` chart page + a header pill on the island map — no week-content changes, no island-graphics changes.

Five user-visible deliverables:

| # | What |
|---|---|
| 1 | `curriculum_packs.name_zh` + `name_en` columns added (migration 0015); Map 1 named "加勒比海 / Caribbean Sea" |
| 2 | Map 2 seeded as a real `curriculum_packs` row (slug `pirate-class-level-2`, no weeks) with name "印度洋 / Indian Ocean" |
| 3 | `/play/[childId]/maps` page — `<MapsHub>` showing all packs as cards (current pack highlighted, locked pack dimmed with "🔒 即将开放 / Coming soon" overlay) |
| 4 | Header pill on `/play/[childId]/page.tsx` showing `📍 加勒比海 ⬇` — taps to `/maps` |
| 5 | Active-pack switching: tapping an unlocked map card updates `child_profiles.current_curriculum_pack_id`; the island map immediately reflects the switch on next visit |

## 2. Architecture overview

**Three subsystems**, all small and additive:

1. **Schema** — migration 0015 adds `name_zh` + `name_en` to `curriculum_packs`. Seed script renames the existing Map 1 pack and inserts the empty Map 2 pack.
2. **DB query layer** — `listMapsForChild(childId)`: returns all public packs ordered by some natural ordering (we'll use `created_at ASC` for now), with a `hasContent` flag (true if pack has ≥1 published week) and `isCurrent` (matches `child.current_curriculum_pack_id`). 
3. **UI** — three new components: `<MapHeaderPill>` (home), `<MapsHub>` (the `/maps` server-page renders this), `<MapCard>` (per-pack tile, locked variant). Plus a `switchMapAction` server action.

Total files: 4 new + 4 modified + 1 migration + 1 seed-update script. ~250-350 LOC.

## 3. Schema changes

### Migration 0015 — bilingual curriculum_packs

```ts
// src/db/schema/content.ts — extend existing curriculumPacks declaration
export const curriculumPacks = pgTable(
  'curriculum_packs',
  {
    // …existing columns…
    nameZh: text('name_zh'),  // nullable initially; backfill via UPDATE in migration
    nameEn: text('name_en'),
  },
  // …existing indexes…
);
```

Migration steps (Drizzle generates):
1. `ALTER TABLE curriculum_packs ADD COLUMN name_zh text;`
2. `ALTER TABLE curriculum_packs ADD COLUMN name_en text;`

**Post-migration data fix** (one-off via a tiny script `scripts/seed-multi-map.ts`):
- `UPDATE curriculum_packs SET name_zh='加勒比海', name_en='Caribbean Sea' WHERE slug='pirate-class-level-1';`
- `INSERT INTO curriculum_packs (slug, name, name_zh, name_en, is_public, owner_user_id) VALUES ('pirate-class-level-2', 'Indian Ocean / 印度洋', '印度洋', 'Indian Ocean', true, NULL);`

(The existing `name` column stays — UI prefers `nameZh`/`nameEn` when present, falls back to `name` for older rows.)

## 4. DB query layer

### `src/lib/db/maps.ts` (new)

```ts
export interface MapForChild {
  packId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  isCurrent: boolean;
  isLocked: boolean;       // true if pack has zero published weeks
  weekCount: number;
  clearedCount: number;
}

export async function listMapsForChild(childId: string): Promise<MapForChild[]>;

export async function setCurrentPackForChild(
  childId: string,
  packId: string,
): Promise<void>;  // updates child_profiles.current_curriculum_pack_id
```

Implementation: one query joining `curriculum_packs` ← `weeks` (LEFT JOIN, aggregated COUNT), and another reading current pack id from `child_profiles`. Plus a join with `progress` (`child_pack_progress` or whatever week-progress lives in) to fill `clearedCount`. `isLocked` = `weekCount === 0`.

## 5. Server action

### `src/lib/actions/maps.ts` (new, `'use server'`)

```ts
'use server';

export async function switchMapAction(packId: string): Promise<void>;
```

- Calls `requireChild` to resolve current child + auth.
- If `packId` references a pack with `weekCount === 0`, throws `MapLockedError` (no-op, surfaced by UI as a toast).
- Else calls `setCurrentPackForChild(childId, packId)` + `revalidatePath('/play/[childId]')` to flush home cache.

`MapLockedError` lives in `src/lib/errors/maps-errors.ts` (pure, client-safe).

## 6. UI

### `MapHeaderPill` (`src/components/play/MapHeaderPill.tsx`, server component)

Props: `{ childId: string; currentMap: { nameZh: string; nameEn: string } }`.

Renders:
```
📍 加勒比海 / Caribbean Sea ⬇
```
as a `<Link href="/play/[childId]/maps">` styled as a rounded pill in `--color-ocean-100`/`--color-ocean-700`. Sits between the avatar header and `<WeekStrip>` on the home page.

### `MapsHub` (`src/components/play/MapsHub.tsx`, server component)

Props: `{ childId: string; maps: MapForChild[] }`.

Renders `<main>` with:
- Title: "航海图 · Nautical Charts"
- Subtitle: "选择你要探险的海域 · Choose your sea"
- Stack of `<MapCard>` per map

### `MapCard` (`src/components/play/MapCard.tsx`, client component — interactive)

Props: `{ childId: string; map: MapForChild }`.

Three visual states:
- **Current map**: gold border, "👉 你正在这里 / You're here" badge, large island-emoji preview, weekCount + clearedCount stats.
- **Switchable** (unlocked, not current): default outline. Tap → calls `switchMapAction(packId)` then `router.push(\`/play/${childId}\`)`.
- **Locked** (`isLocked === true`): dim opacity, lock icon overlay, "即将开放 / Coming soon" text. Tap → tiny toast: "敬请期待 / Stay tuned!" (no nav).

### Home page integration

`src/app/play/[childId]/page.tsx` (modify):
- Fetch the current pack name from `currentCurriculumPackId` via `getCurrentMap(childId)` (already in `maps.ts`).
- Insert `<MapHeaderPill ... />` between the avatar `<section>` and `<WeekStrip>`.

### `/play/[childId]/maps/page.tsx` (new server page)

```tsx
export default async function MapsPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const maps = await listMapsForChild(child.id);
  return <MapsHub childId={child.id} maps={maps} />;
}
```

## 7. Out of scope (deliberate deferrals)

- **Per-map island visuals**: today all islands look the same (palm-tree pirate islands). Map 2 (when populated) will reuse Map 1's island style. Theming Indian Ocean differently is a future PR.
- **Map-completion reveal animation**: no "you unlocked Map 2!" celebration. The locked overlay just disappears when David adds the first week to Map 2.
- **Per-map decorations on the home island map**: existing decor (PR #34) doesn't change per map.
- **Cross-map progress / streaks**: streaks + activity are child-level, not pack-level. Stays the same.
- **Chapter-locking by Map 1 completion**: Map 2 is always visible (locked); no gating on Map 1 clear. (Chose "locked card always visible" in brainstorm.)
- **Renaming the `pirate-class-level-1` slug**: stays as-is to avoid breaking code references (`scripts/seed-pirate-class.ts`, etc.). Only `name_zh`/`name_en` change.

## 8. Testing

### Unit tests (Vitest + RTL + jsdom; mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`)

| File | Asserts |
|---|---|
| `tests/unit/lib/db/maps.test.ts` | `listMapsForChild` returns all packs with weekCount + isLocked + isCurrent; `setCurrentPackForChild` updates the right row |
| `tests/unit/lib/actions/maps.test.ts` | `switchMapAction` throws `MapLockedError` for locked pack; succeeds + revalidates for unlocked pack |
| `tests/unit/components/play/MapCard.test.tsx` | 3 states render correctly (current / switchable / locked); locked tap fires toast not nav; unlocked tap calls action then nav |
| `tests/unit/components/play/MapsHub.test.tsx` | renders one card per map; current map shows the badge |
| `tests/unit/components/play/MapHeaderPill.test.tsx` | renders pill with current map nameZh + nameEn; Link to /maps |
| `tests/unit/app/maps-page.test.tsx` | server page fetches + passes maps to MapsHub |

### Manual verification (before opening the PR)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev`, sign in as David, navigate to `/play/[yinuoChildId]`. Header pill shows "📍 加勒比海 / Caribbean Sea ⬇".
3. Tap pill → `/maps` page renders 2 cards: Caribbean (current, gold-bordered, weekCount=10 clearedCount=N) + Indian Ocean (dimmed lock).
4. Tap Indian Ocean → friendly toast, no nav.
5. Tap Caribbean → no-op (already current) or stays on /maps.
6. (Sim) Manually run `UPDATE curriculum_packs SET …` to add a fake week to Indian Ocean — verify card un-dims + becomes tappable.
7. Manually switch via a fake action → home page island map reflects the switched pack on next visit.

## 9. File summary

**New (8):**
- `drizzle/0015_<name>.sql` (migration)
- `scripts/seed-multi-map.ts` (one-off: rename Map 1 + seed Map 2)
- `src/lib/db/maps.ts` (listMapsForChild + setCurrentPackForChild)
- `src/lib/actions/maps.ts` (switchMapAction)
- `src/lib/errors/maps-errors.ts` (MapLockedError)
- `src/components/play/MapHeaderPill.tsx`
- `src/components/play/MapsHub.tsx`
- `src/components/play/MapCard.tsx`
- `src/app/play/[childId]/maps/page.tsx`

**Modified (4):**
- `src/db/schema/content.ts` (add nameZh/nameEn to curriculumPacks)
- `src/app/play/[childId]/page.tsx` (mount MapHeaderPill)
- `src/components/play/KidNavBar.tsx` (extend `isMap` active-tab predicate to cover `/maps`)
- (Optional) `CLAUDE.md` final landmines + Current state entry — done in a follow-up PR same day

**Tests (6):** see §8.

**Net LOC:** ~300-500.

## 10. Dependencies

No new npm packages. Reuses existing `@/db`, `@clerk/nextjs/server`, Tailwind palette tokens.

## 11. Open questions (none blocking)

- Should the Map 2 card show a "preview / coming soon" stat ("ETA: ?") below the lock? — Leaving plain "即将开放 / Coming soon" for now.
- Multi-child: when adding a second child, both children share `curriculum_packs` (Map 1 + Map 2). Each child's `current_curriculum_pack_id` is independent. No multi-child UX changes needed.
