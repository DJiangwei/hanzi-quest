# Backpack Expansion — Flags by Continent (+ Solar System grouping) — Design Spec

**Date:** 2026-06-07
**Status:** approved (design)
**Context:** David's 2nd of three asks (Home module ✅ shipped #70; Story-Mode redesign PAUSED). In Chinese: in the Backpack (背包), (1) the **World Flags** pack should add **many more countries** and be **organized by continent (大洲)** — explicitly for its *learning value* for Yinuo; and (2) the **Solar System** pack should likewise use a **learning grouping**. David's locked scope: *"give all countries' flags in all continents (avoid the controversial ones)"* → all UN sovereign states, grouped by 6 continents, skip disputed/observer territories (my judgment, exclusions listed below).

---

## 1. North Star

> Yinuo opens 世界国旗 / World Flags in her Backpack and scrolls a real atlas: a 🌏 亚洲 / Asia header, then a grid of Asian flags; 🌍 非洲 / Africa, then African flags; and so on through all six inhabited continents. Each flag card wears a small continent tag. Collecting a flag teaches her *where in the world* it belongs. The same section-header treatment groups the Solar System by body type (rocky / gas / ice / star / moon).

---

## 2. Locked decisions

- **All 193 UN member states**, grouped into **6 continents**: 亚洲 Asia · 欧洲 Europe · 非洲 Africa · 北美洲 North America · 南美洲 South America · 大洋洲 Oceania. (Antarctica omitted — no countries.) Up from today's 31 → **~162 new countries**.
- **Skip disputed / non-UN-member territories** to stay uncontroversial (see §8 exclusion list).
- **Continent grouping = vertical-scroll section headers** (one labeled header per continent, the flag grid beneath each). No filter tabs. Reused verbatim for Solar System grouped by `type`.
- **Per-card continent tag** on every flag card (mirrors the existing Solar `type` badge) — reinforces the geography lesson.
- **AI-generated bilingual content** (ZH name, ZH capital, bilingual one-line fun-fact lore) via DeepSeek in a **one-off offline generation script**, spot-checked, committed into `flagsData.ts`. **No runtime AI.** The 31 existing curated entries keep their hand-written lore.
- **No DB migration.** `continent` is a TS field on `FlagItem`, derived at render by slug — exactly how Solar's `type` already works. Grouping is display-only.
- **Gacha / drop mechanics unchanged.** `dropWeight` / `paidPullCost` / pull + shard-swap logic untouched. Grouping affects only the Backpack grid render.
- **Bilingual rule (locked):** every kid-facing field renders ZH + EN side-by-side. No toggle.

---

## 3. Data model

### 3.1 `FlagItem` gains `continent`

`src/lib/collections/flagsData.ts`:

```ts
export type Continent =
  | 'asia' | 'europe' | 'africa'
  | 'north_america' | 'south_america' | 'oceania';

export const CONTINENT_LABELS: Record<Continent, { zh: string; en: string; emoji: string }> = {
  asia:          { zh: '亚洲',   en: 'Asia',          emoji: '🌏' },
  europe:        { zh: '欧洲',   en: 'Europe',        emoji: '🌍' },
  africa:        { zh: '非洲',   en: 'Africa',        emoji: '🌍' },
  north_america: { zh: '北美洲', en: 'North America', emoji: '🌎' },
  south_america: { zh: '南美洲', en: 'South America', emoji: '🌎' },
  oceania:       { zh: '大洋洲', en: 'Oceania',       emoji: '🌏' },
};

/** Fixed display order for grouped render. */
export const CONTINENT_ORDER: Continent[] = [
  'asia', 'europe', 'africa', 'north_america', 'south_america', 'oceania',
];

export interface FlagItem {
  slug: string;
  iso2: string;        // NEW — ISO-3166 alpha-2, lowercase; emoji derivable from it
  emoji: string;       // kept literal (generated once) so the renderer is unchanged
  continent: Continent;// NEW
  nameZh: string;
  nameEn: string;
  capitalZh: string;
  capitalEn: string;
  loreZh: string;
  loreEn: string;
  rarity: FlagRarity;
  dropWeight: number;
}
```

- **`emoji` stays a literal field** (no renderer change). It is *generated* from `iso2` by the gen script via the regional-indicator transform (`A→🇦 … Z→🇿`, two letters), so we never hand-type ~190 emoji.
- `iso2` is stored for provenance / future `<img>` flag-sheet swap, and as the deterministic emoji source.
- Cross-continental countries (Russia, Türkiye, Egypt, Kazakhstan, Cyprus, Armenia, Azerbaijan, Georgia…) are assigned to **exactly one** continent by common kid-atlas convention (documented inline in the data file). One country = one section.

### 3.2 Per-continent counts (≈)

| Continent | Count |
|---|---|
| 亚洲 Asia | ~48 |
| 欧洲 Europe | ~44 |
| 非洲 Africa | 54 |
| 北美洲 North America (incl. Central America + Caribbean) | ~23 |
| 南美洲 South America | 12 |
| 大洋洲 Oceania | ~14 |
| **Total** | **~193** |

Rarity is assigned by recognizability so familiar flags drop first: well-known (G20 + neighbors + famous) = `common` (weight 3), mid-familiarity = `rare` (weight 2), less-familiar / micro-states = `epic` (weight 1). Roughly 55 common / 85 rare / 53 epic.

### 3.3 Solar System — no data change

`solarSystemData.ts` already has `type: SolarBodyType` + `TYPE_LABELS`. Solar grouping reuses them as-is. No new field.

---

## 4. Generic grouped render

### 4.1 Registry gains an optional `grouping`

`src/lib/collections/packRegistry.ts` — extend `PackUiMeta`:

```ts
export interface PackGrouping {
  /** item slug → group key (null = ungrouped bucket, rendered last). */
  resolveGroup: (slug: string) => string | null;
  /** Fixed section order, top → bottom. */
  order: string[];
  /** Bilingual + emoji header label per group key. */
  labels: Record<string, { zh: string; en: string; emoji: string }>;
}

export interface PackUiMeta {
  // …existing fields…
  /** When present, the pack page renders section headers per group. */
  grouping?: PackGrouping;
}
```

- `flags-v1`: `grouping = { resolveGroup: (s) => FLAGS_BY_SLUG[s]?.continent ?? null, order: CONTINENT_ORDER, labels: CONTINENT_LABELS }`.
- `solar-system-v1`: `grouping = { resolveGroup: (s) => SOLAR_BODIES_BY_SLUG[s]?.type ?? null, order: SOLAR_TYPE_ORDER, labels: TYPE_LABELS_WITH_EMOJI }` (add a small `{emoji}` to each Solar type label, or a parallel emoji map).
- This is **client-safe**: `PackPageBody` is `'use client'` and already calls `getPackMeta(packSlug)` itself — the function-bearing `grouping` is resolved client-side, never serialized across RSC (same pattern as the existing `ItemCard` / `resolveRevealEmoji`). **Do not** pass `meta`/`grouping` as a prop from a server component.

### 4.2 `PackPageBody` grouped mode

`PackPageBody` currently renders **one inline grid** (with dupe ×N badges + swap chips). Refactor that grid block into a reusable inner piece and branch:

- **Ungrouped (`meta.grouping` absent):** unchanged — the existing single grid (zodiac, sea-creatures, dinosaurs).
- **Grouped (`meta.grouping` present):** iterate `grouping.order`; for each group, render a **section header** (`{emoji} {zh} / {en}` + a `owned/total` count for that group) followed by a grid of just that group's items. Any items whose `resolveGroup` returns `null` or an unlisted key render in a trailing "其他 / Other" section (defensive; should be empty).
- The per-tile inner content (Card + dupe badge + swap chip) is **identical** in both modes — extract it into a small `PackTile` sub-component (or a local render fn) so the two paths share it. No behavior change to swap/dupe.
- Header counts: compute per-group owned via the existing `ownedSet`.

Sections stack vertically; the whole page scrolls (it already does). No sticky headers in v1 (could add later).

### 4.3 `FlagCard` continent tag

Add a continent badge to `FlagCard`, mirroring `SolarBodyCard`'s type badge (shown when `!compact`): a small rounded pill `{emoji} {continentZh} · {continentEn}`, greyed when unowned. Resolve via `FLAGS_BY_SLUG[item.slug].continent → CONTINENT_LABELS`. Keep it visually light so the card stays uncluttered at `md`.

---

## 5. Content generation (one-off, offline)

`scripts/generate-flags-data.ts` (dev-time only; not run in prod build):

- **I source the factual base table** (committed in the script or a JSON alongside): `{ iso2, slug, nameEn, capitalEn, continent, rarity }` for all 193 — these are facts I provide, not AI-guessed.
- **DeepSeek (`@ai-sdk/deepseek` + `generateObject`, batched)** fills `{ nameZh, capitalZh, loreZh, loreEn }` per country: standard Chinese country + capital names, and a single kid-friendly bilingual fun fact (one short sentence each, age-6 vocabulary, no politics).
- The script computes `emoji` from `iso2` (regional-indicator transform), merges with the factual base, **preserves the 31 existing curated entries' lore verbatim** (only adds `iso2` + `continent` to them), and writes the full sorted `FLAGS` array back into `flagsData.ts`.
- **I spot-check** the generated ZH names/capitals (especially small/unusual countries) before committing. Mis-translations get hand-fixed in the data file.
- Cost ≈ a few cents (one DeepSeek pass over ~162 countries). Idempotent to re-run; output is reviewed, then the generated `flagsData.ts` is committed as plain data — runtime never calls DeepSeek.

This mirrors the established `backfill-word-image-hooks.ts` pattern (AI fills a column offline; product reads static data).

---

## 6. Seeding

`scripts/seed-flags-pack.ts` already **inserts only missing slugs** (idempotent, keyed by slug under `flags-v1`). It reads `FLAGS`, so once the data file is expanded:

- Re-running post-merge inserts the ~162 new `collectible_items` rows (bilingual name + capital-prefixed lore + emoji in `image_url`); the existing 31 are untouched.
- **No re-seed needed for `continent`** — it's derived from `flagsData.ts` at render by slug, never stored. Existing cards gain their continent tag automatically on deploy.
- Post-merge op: `pnpm tsx scripts/seed-flags-pack.ts` against prod (confirm before running — shared `DATABASE_URL`).

---

## 7. Files

**New**
- `scripts/generate-flags-data.ts` — offline DeepSeek content generation (dev-only).
- (data) the regenerated `src/lib/collections/flagsData.ts` (193 entries + `Continent` type + `CONTINENT_LABELS` + `CONTINENT_ORDER` + `iso2`).

**Modified**
- `src/lib/collections/flagsData.ts` — `FlagItem` gains `iso2` + `continent`; full 193-country list; continent metadata exports.
- `src/lib/collections/solarSystemData.ts` — add `SOLAR_TYPE_ORDER` + an emoji per type (small additive export for the section header).
- `src/lib/collections/packRegistry.ts` — `PackGrouping` interface + `grouping` on `flags-v1` and `solar-system-v1`.
- `src/components/play/PackPageBody.tsx` — extract `PackTile`, add grouped-section render branch.
- `src/components/play/items/FlagCard.tsx` — continent badge.
- `CLAUDE.md` — current-state + a landmine (grouping is client-only config; continent is derived TS, not a DB column).
- `scripts/seed-flags-pack.ts` — header comment count update (30 → 193); logic unchanged (already insert-missing).

**No migration. No recompile** (collection packs don't touch `week_levels`).

---

## 8. Exclusions (disputed / non-UN — skipped per David's "avoid the controversial ones")

Not included (kept out to stay uncontroversial; all are non-UN-members or disputed): **Taiwan, Kosovo, Palestine, Western Sahara, Vatican City (Holy See), Northern Cyprus, Abkhazia, South Ossetia, Transnistria, Somaliland, and other partially-recognized or observer entities.** The set is exactly the **193 UN member states**. (Vatican is excluded only because it's a non-member observer, not for controversy; flag it if you'd want it added.)

---

## 9. Out of scope (v1)

- Filter tabs / search within a pack (scroll-only).
- Real `<img>` flag artwork (emoji glyphs only; `iso2` is stored so a future flag-sheet swap is a one-file change).
- Sticky section headers, collapse/expand sections.
- Re-balancing gacha for the larger pool (dropWeight unchanged; weighted-unowned bonus already biases pulls toward missing cards — accepted by David).
- Backpack-wide changes to other packs' layout.
- Solar System content additions (grouping only).

---

## 10. Testing

- **flagsData:** 193 entries; every entry has all required fields incl. `iso2` (2 lowercase letters) + a valid `continent`; slugs unique; `iso2` unique; `emoji` derives from `iso2`; each continent non-empty; `CONTINENT_ORDER` covers all 6 keys; existing 31 slugs still present with preserved lore.
- **registry:** `flags-v1` + `solar-system-v1` expose `grouping`; `resolveGroup` returns a key in `order` for every pack item (no orphans); other packs have no `grouping`.
- **PackPageBody grouped render:** renders one section header per non-empty group in `order`; each section's grid holds only that group's items; per-group owned/total count correct; ungrouped packs still render the single flat grid; dupe badge + swap chip behavior identical in both modes (regression).
- **FlagCard:** renders continent badge (zh+en) when `!compact`; greyed when unowned; hidden when `compact`.
- **solarSystemData:** `SOLAR_TYPE_ORDER` covers all 5 types; emoji-per-type present.
- (gen script not unit-tested — dev-only; the committed data file is the tested artifact.)

---

## 11. Done criteria

- World Flags shows all 193 countries grouped under 6 scrollable continent sections, each flag card tagged with its continent; Solar System shows its 10 bodies grouped by type.
- Existing 31 flags keep their curated lore + gain continent tags; ~162 new flags seed cleanly.
- Gacha pulls / shard swaps behave exactly as before.
- `pnpm typecheck && lint && test && build` green; `seed-flags-pack.ts` runs idempotently.
