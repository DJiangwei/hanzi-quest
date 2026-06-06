# Space + Unicorn Avatar Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add two code-only avatar themes — Space (太空) + Unicorn & Rainbow (独角兽彩虹), ~11 procedural-SVG items each across the 7 slots — following the PR #58 multi-theme pattern.

**Architecture:** Register two values in `AVATAR_THEMES` (the chip strip + filter pick them up automatically), add 22 `ItemDef`s to the catalog, update coverage/filter tests. No schema/migration; re-run the existing seed post-merge.

**Tech Stack:** React 19 (SVG), TypeScript, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-06-space-unicorn-avatar-themes-design.md`
**Branch:** `feat/space-unicorn-themes` (spec committed).

---

## Pattern reference (verified)

- `src/lib/avatar/themes.ts` — `AVATAR_THEMES = ['pirate','caribbean'] as const` + `THEME_DISPLAY_NAMES`. `isAvatarTheme` guard.
- `ThemeChipStrip` maps over `AVATAR_THEMES` → chips auto-appear; **no chip-component edit**.
- `src/lib/avatar/itemCatalog.tsx` — items are `ItemDef` objects collected into the catalog array; helpers `allItems()/shopItemsCatalog()/defaultItems()` derive from it. `ItemDef = { unlockRef: string; slot: AvatarSlotId; displayName: string; rarity?: ItemRarity; priceCoins?: number; theme: AvatarTheme; renderSvg: () => ReactElement }`. SVG is authored in a **100×100 viewBox** (face centered ~cx50 cy46; hats top; pants/legs lower; background fills). Copy an existing same-slot caribbean/pirate item as a structural template per slot.
- `AvatarRender` iterates `AVATAR_SLOT_IDS` — new items render with no change.
- Seed `scripts/seed-shop-avatar-items.ts` already upserts all 7 slots + `theme` (PR #59) — **no seed-script edit**; run post-merge.

---

## Task 1: Register the two themes

**Files:** Modify `src/lib/avatar/themes.ts`; Test `tests/unit/avatar/theme-chip-strip.test.tsx` (+ a themes assertion).

- [ ] **Step 1: Failing test.** Add to the theme-chip-strip test (and/or a small `themes.test.ts`): assert `AVATAR_THEMES` includes `'space'` and `'unicorn'`; `isAvatarTheme('space')===true`; `THEME_DISPLAY_NAMES.space.zh==='太空'` and `.unicorn.zh==='独角兽彩虹'`; `ThemeChipStrip` renders a chip whose text includes `太空` and one including `独角兽彩虹`.

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/avatar/theme-chip-strip.test.tsx` → FAIL.

- [ ] **Step 3: Implement.** In `src/lib/avatar/themes.ts`:

```ts
export const AVATAR_THEMES = ['pirate', 'caribbean', 'space', 'unicorn'] as const;
export type AvatarTheme = (typeof AVATAR_THEMES)[number];

export const THEME_DISPLAY_NAMES: Record<AvatarTheme, { zh: string; en: string }> = {
  pirate: { zh: '海盗', en: 'Pirate' },
  caribbean: { zh: '加勒比', en: 'Caribbean' },
  space: { zh: '太空', en: 'Space' },
  unicorn: { zh: '独角兽彩虹', en: 'Unicorn' },
};
```
(`isAvatarTheme` unchanged — it reads `AVATAR_THEMES`.)

- [ ] **Step 4: Run green + commit.** `pnpm vitest run tests/unit/avatar/theme-chip-strip.test.tsx` → PASS; `pnpm typecheck` → clean.

```bash
git add src/lib/avatar/themes.ts tests/unit/avatar/theme-chip-strip.test.tsx
git commit -m "feat(avatar-themes): register space + unicorn themes"
```

---

## Task 2: Author the 11 Space items

**Files:** Modify `src/lib/avatar/itemCatalog.tsx`.

- [ ] **Step 1: Add 11 `ItemDef`s** with `theme: 'space'`, registered in the catalog array (where caribbean items are registered). Use the spec §4 table for `unlockRef / slot / displayName / rarity / priceCoins`. Author each `renderSvg()` as a flat-color procedural SVG `<g>` in the 100×100 space, matching the slot of the nearest existing item (e.g. model `astronautHelmet`/`spaceVisor` on existing `hat` items, `spacesuitTop`/`alienTee` on `top` items, `bgStarfield`/`bgNebula` on the `background` item, `jetpackDecor`/`rocketDecor` on a `decor` item, `spaceHairSilver` on a `hair` item, `spaceFaceCool` on the `head` item, `spacesuitPants` on a `pants` item). Keep it kid-friendly + readable at small size; give each `<g>` a unique `key`.

  Art briefs: **astronautHelmet** = white domed helmet with a tinted visor over the face; **spaceVisor** = sleek goggles band; **spacesuitTop** = white/grey suit with a chest control panel + blue trim; **alienTee** = green tee with a little UFO/alien motif; **spacesuitPants** = white suit legs with grey moon-boots; **jetpackDecor** = two thruster packs with orange flame; **rocketDecor** = small red-white rocket; **bgStarfield** = dark navy with scattered stars; **bgNebula** = purple/pink swirling nebula with stars; **spaceHairSilver** = short silver hair; **spaceFaceCool** = a friendly face (template off `caribKidTan`/`default-kid-warm`) with a cool skin tone.

- [ ] **Step 2: Verify it compiles + renders.** `pnpm typecheck` → clean. Run the existing catalog test to ensure nothing broke yet (counts updated in Task 4): `pnpm vitest run tests/unit/avatar/item-catalog-theme-coverage.test.ts` (may fail on count until Task 4 — that's fine; ensure no render/throw errors).

- [ ] **Step 3: Commit.**

```bash
git add src/lib/avatar/itemCatalog.tsx
git commit -m "feat(avatar-themes): 11 Space (太空) avatar items"
```

---

## Task 3: Author the 11 Unicorn items

**Files:** Modify `src/lib/avatar/itemCatalog.tsx`.

- [ ] **Step 1: Add 11 `ItemDef`s** with `theme: 'unicorn'`, per spec §4. Art briefs: **unicornFace** = friendly pastel face; **rainbowHair** = long hair in rainbow bands; **pastelBraids** = two pink/purple braids; **unicornHornband** = gold spiral horn on a headband; **starCrown** = gold crown with star gems; **rainbowTee** = top with rainbow stripes; **sparkleTop** = pastel top with sparkles; **rainbowSkirt** = rainbow A-line skirt (pants slot); **starWandDecor** = a star-topped magic wand beside the avatar; **bgRainbowSky** = soft blue sky with a big rainbow; **bgPastelClouds** = pink/lilac clouds. Same 100×100 SVG conventions + unique `<g key>`.

- [ ] **Step 2: Verify compiles.** `pnpm typecheck` → clean.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/avatar/itemCatalog.tsx
git commit -m "feat(avatar-themes): 11 Unicorn & Rainbow (独角兽彩虹) avatar items"
```

---

## Task 4: Coverage + filter tests

**Files:** Modify `tests/unit/avatar/item-catalog-theme-coverage.test.ts`, `tests/unit/avatar/avatar-tab-body-filter.test.tsx`.

- [ ] **Step 1: Update the coverage test.** Assert: total catalog grew by 22 (update the expected total — read the current expected number and add 22, or assert `>= previous+22`); `space` items count === 11; `unicorn` items count === 11; every item's `theme ∈ AVATAR_THEMES`; every item's `slot ∈ AVATAR_SLOT_IDS`; every shop item (priceCoins set) has a `rarity`; calling `renderSvg()` for each new item returns a truthy element without throwing (render-smoke — wrap in a `<svg>` via RTL render and assert it mounts).

- [ ] **Step 2: Update the filter test.** In `avatar-tab-body-filter.test.tsx`, add a case: selecting the `space` chip shows only `space` items (and `unicorn` shows only unicorn). Follow the existing caribbean filter assertion pattern.

- [ ] **Step 3: Run green.** `pnpm vitest run tests/unit/avatar/` → PASS. `pnpm typecheck && pnpm lint` → clean.

- [ ] **Step 4: Commit.**

```bash
git add tests/unit/avatar/
git commit -m "test(avatar-themes): coverage (space=11, unicorn=11) + chip filter"
```

---

## Task 5: Docs + four-green gate + PR

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: CLAUDE.md.** Update the PR #58 "Current state" area / add a short entry: two new avatar themes (Space + Unicorn), catalog 41 → 63, code-only (no migration). Reaffirm the existing landmines (theme is `text`; seed script must set theme + cover 7 slots — both already satisfied). Note the **post-merge seed op**. Update "last refreshed".

- [ ] **Step 2: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → green.

- [ ] **Step 3: Commit, push, PR.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record Space + Unicorn avatar themes"
git push -u origin feat/space-unicorn-themes
gh pr create --title "feat(avatar-themes): Space (太空) + Unicorn (独角兽彩虹) avatar themes" --base main
```

PR body: two code-only avatar themes, 22 procedural-SVG items across the 7 slots, auto-added shop chips, catalog 41 → 63, no migration. **Post-merge:** `pnpm tsx scripts/seed-shop-avatar-items.ts` against prod (idempotent; seeds the 22 new shop rows).

---

## Self-review notes (addressed)

- **Spec coverage:** themes → T1; Space items → T2; Unicorn items → T3; tests → T4; docs+gate+seed-note → T5. ✓
- **No code changes needed** to `ThemeChipStrip` (maps `AVATAR_THEMES`), `AvatarRender` (maps `AVATAR_SLOT_IDS`), or the seed script (7 slots + theme since PR #59) — called out so subagents don't touch them. ✓
- **Intentional mid-plan red:** the coverage-count test fails between T2 and T4 — expected; fixed in T4. ✓
- **No migration:** `avatar_items.theme` is `text`; themes are code-only. Seed re-run is the only prod op. ✓
