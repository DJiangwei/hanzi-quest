# Space + Unicorn Avatar Themes — Design Spec

**Date:** 2026-06-06
**Status:** approved (design)
**Context:** PR #58 built the multi-theme avatar system (7 slots, `theme` text column, `ThemeChipStrip` filter) with Pirate + Caribbean. Themes are **code-only additions** (`AVATAR_THEMES` is a TS text union, no pgEnum/migration). David wants two more themes for Yinuo: **Space / 太空** and **Unicorn & Rainbow / 独角兽彩虹** (a girlier theme), ~11 mix-and-match items each across all 7 slots. Pure content PR following the established pattern.

---

## 1. Goal

Add two new avatar themes (~22 items total) so Yinuo can build a full Space look or a full Unicorn/Rainbow look, filterable by new shop chips. No DB migration, no new mechanics — extends `itemCatalog.tsx` + `themes.ts` and re-runs the existing seed.

---

## 2. Locked decisions

- Two themes: `space` (太空) and `unicorn` (独角兽彩虹).
- ~11 items per theme spanning all 7 slots (head/hair/hat/top/pants/decor/background).
- Procedural flat-color SVG, mix-and-match (no theme lock — items from any theme combine freely, same as PR #58).
- Prices/rarities mirror existing shop items (common 80–150, rare 250–400, epic 600–900).
- No new defaults required (the existing pirate defaults cover head/hair/pants/top/hat/background; `decor` stays default-less). New items are all `unlock_via='shop'`.

---

## 3. How the pattern works (PR #58, verified)

- `src/lib/avatar/themes.ts`: `AVATAR_THEMES` text union + `THEME_DISPLAY_NAMES`. **`ThemeChipStrip` maps over `AVATAR_THEMES` dynamically**, so adding themes here auto-adds the `[Space] [Unicorn]` chips — no chip-component change.
- `src/lib/avatar/itemCatalog.tsx`: each `ItemDef` has `{ unlockRef, slot, displayName, theme, priceCoins?, rarity?, renderSvg() }`. Shop items have price+rarity; the `theme` field drives the filter.
- Seed: `scripts/seed-shop-avatar-items.ts` iterates the catalog and upserts `avatar_items` + `shop_items` (sets `theme`, handles all 7 `avatar_slots` since the PR #59 hotfix). **No seed-script change** — just run it against prod post-merge.
- `AvatarRender` iterates `AVATAR_SLOT_IDS`, so new items render with zero render-code change.

---

## 4. Item catalog (~22 new `ItemDef`s)

### 🚀 Space / 太空 (theme `space`) — 11
| unlockRef | slot | 中文 | rarity | ¢ |
|---|---|---|---|---|
| `spaceFaceCool` | head | 太空脸 | common | 120 |
| `spaceHairSilver` | hair | 银色短发 | common | 140 |
| `astronautHelmet` | hat | 宇航头盔 | rare | 320 |
| `spaceVisor` | hat | 太空护目镜 | common | 150 |
| `spacesuitTop` | top | 宇航服上衣 | rare | 300 |
| `alienTee` | top | 外星人T恤 | common | 130 |
| `spacesuitPants` | pants | 宇航服裤子 | common | 140 |
| `jetpackDecor` | decor | 喷气背包 | rare | 360 |
| `rocketDecor` | decor | 小火箭 | rare | 340 |
| `bgStarfield` | background | 星空 | common | 120 |
| `bgNebula` | background | 星云 | epic | 600 |

### 🦄 Unicorn & Rainbow / 独角兽彩虹 (theme `unicorn`) — 11
| unlockRef | slot | 中文 | rarity | ¢ |
|---|---|---|---|---|
| `unicornFace` | head | 独角兽脸 | common | 120 |
| `rainbowHair` | hair | 彩虹长发 | rare | 320 |
| `pastelBraids` | hair | 粉彩辫子 | common | 140 |
| `unicornHornband` | hat | 独角兽角 | rare | 340 |
| `starCrown` | hat | 星星王冠 | epic | 650 |
| `rainbowTee` | top | 彩虹上衣 | common | 130 |
| `sparkleTop` | top | 闪亮上衣 | rare | 300 |
| `rainbowSkirt` | pants | 彩虹裙 | common | 150 |
| `starWandDecor` | decor | 星星魔棒 | rare | 340 |
| `bgRainbowSky` | background | 彩虹天空 | common | 120 |
| `bgPastelClouds` | background | 粉彩云朵 | common | 130 |

Names/prices are tunable during build; counts (11/theme) and slot coverage are the contract. Each `renderSvg()` is a small flat-color procedural SVG in the slot's coordinate space (copy the structure of the existing caribbean items as templates per slot).

---

## 5. Files

**Modified**
- `src/lib/avatar/themes.ts` — add `'space'`, `'unicorn'` to `AVATAR_THEMES` + `THEME_DISPLAY_NAMES` (`{zh:'太空',en:'Space'}`, `{zh:'独角兽彩虹',en:'Unicorn'}`).
- `src/lib/avatar/itemCatalog.tsx` — add the 22 `ItemDef`s (each `theme:'space'|'unicorn'`).
- Tests: `tests/unit/avatar/item-catalog-theme-coverage.test.ts` (assert space=11, unicorn=11, every item has a valid theme + renders), `theme-chip-strip` / `avatar-tab-body-filter` (assert the new chips appear + filter). Possibly a themes-display test.
- `CLAUDE.md` — Current state + the "adding a theme is code-only" note (already a landmine; just update counts).

**No** schema/migration. **No** `ThemeChipStrip` / `AvatarRender` / seed-script code changes.

---

## 6. Testing

- `item-catalog-theme-coverage`: total catalog count grew by 22; `space` and `unicorn` each have 11; each new item has `theme ∈ AVATAR_THEMES`, a non-empty `displayName`, a `slot ∈ AVATAR_SLOT_IDS`, price+rarity set, and `renderSvg()` returns an element without throwing (render-smoke).
- `themes`: `isAvatarTheme('space')` / `'unicorn'` true; `THEME_DISPLAY_NAMES` has both.
- `ThemeChipStrip`: renders `[全部][海盗][加勒比][太空][独角兽彩虹]` chips; selecting one calls `onSelect` with that value.
- Avatar shop filter test: selecting Space shows only space items.

---

## 7. Out of scope

- New avatar **slots** or render logic (unchanged).
- Theme-locked sets / outfits (items stay mix-and-match).
- Equipping logic, DB schema (`theme` already exists).
- Indian-Ocean / other themes (separate later).

---

## 8. Build flow + post-merge

spec → plan → build (subagent TDD) → four-green gate → optional local-dev avatar-shop glance → PR + merge. **Post-merge op:** `pnpm tsx scripts/seed-shop-avatar-items.ts` against prod (seeds the 22 new shop rows; idempotent). No migration.

---

## 9. Done criteria

- Avatar shop shows `[全部][海盗][加勒比][太空][独角兽彩虹]` chips; each new theme filters to its 11 items; all render in the shop + on the equipped avatar.
- Catalog 41 → 63 items.
- `pnpm typecheck && lint && test && build` green; seed runs clean against prod.
