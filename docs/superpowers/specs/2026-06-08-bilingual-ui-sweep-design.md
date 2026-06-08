# Bilingual UI Sweep — Design Spec

**Date:** 2026-06-08
**Status:** approved (design locked via David's choices)
**Context:** Yinuo is English-native (UK heritage learner) and the whole point of the app is to learn Chinese — so **every** kid-facing label must show **both** languages. Today the chrome is inconsistent: the bottom nav mixes languages per-tab ('Map' EN-only, '背包/日历/家/商店' ZH-only), shop category tabs are ZH-only (装扮/音效/伙伴/装饰/道具/家具), and a few labels (shop rarity 普通/稀有/史诗) are ZH-only — while dialogs and many toasts already use the bilingual "中文 / English" pattern.

This is the first of two next-stage items (the avatar try-on redesign follows in a separate spec).

---

## 1. North Star

> Wherever Yinuo can tap or read a label — a nav tab, a shop category, a button, a section header, a dialog — she sees the Chinese **and** the English, every time. Nothing is single-language.

---

## 2. Locked decisions

- **Format = one line, ZH first: `中文 / English`.** For tight stacked labels (bottom nav, shop category tabs) the label line is `背包 / Bag` on a single line at a small font. This matches the existing dialog/toast convention and keeps Chinese primary (learning-first) with English always present.
- **Scope = all UI chrome:** every nav tab, shop/category/filter tab, button, section header, dialog, empty state, and selection label. Collectible **card names** (zodiac/flags/etc.) are already bilingual and out of scope; AI-generated **content** (story chapters, scene stimuli) is out of scope.
- **No new i18n framework.** This is a pirate-themed personal app for one kid, not a localized product. Bilingual strings stay inline as `中文 / English` (or a tiny shared helper), NOT a translation-key system.

---

## 3. Approach

A single shared convention + a file-by-file sweep of kid-facing components.

### 3.1 Shared helper (light touch)
Add a tiny pure helper so the convention is consistent and greppable:

```ts
// src/lib/i18n/bilingual.ts
/** Join a Chinese + English label as "中文 / English" (the app-wide convention). */
export function bi(zh: string, en: string): string {
  return `${zh} / ${en}`;
}
```

Use it where a plain string label is passed (nav tabs, category tabs, rarity). For JSX that already stacks two `<span>`s (e.g. the section headers, card name + sub-name), keep the two-span pattern — don't force everything through `bi()`. The helper is for the single-string label sites.

### 3.2 Known gaps to fix (enumerated)
- **`KidNavBar`** (5 tabs): `Map → 地图 / Map`, `背包 → 背包 / Bag`, `日历 → 日历 / Calendar`, `家 → 家 / Home`, `商店 → 商店 / Shop`. Render the label line at `text-[10px]` (down from `text-xs`) and widen tab min-width slightly so `背包 / Bag` fits one line on a ~360px phone. The ⚙️ gear keeps its `aria-label` (icon-only is fine — but give it `aria-label="设置 / Settings"`).
- **`ShopCategoryTabs`** (6 tabs): `装扮 → 装扮 / Looks`, `音效 → 音效 / Sounds`, `伙伴 → 伙伴 / Pets`, `装饰 → 装饰 / Decor`, `道具 → 道具 / Items`, `家具 → 家具 / Furniture`. `aria-label="商店分类"` → `"商店分类 / Shop categories"`.
- **`ShopItemCard`** `RARITY_LABEL`: `普通 / Common`, `稀有 / Rare`, `史诗 / Epic`. Also the `aria-label` price suffix `，价格 N 金币` → add ` / N coins`.
- **Sweep the rest:** grep every `src/components/{play,shop,scenes,home}/**` and kid-facing `src/app/play/**` file for string labels containing CJK without a ` / ` (or an adjacent English span) and an English-only label with no Chinese. Fix each to bilingual. Candidates already spotted as **already bilingual** (leave as-is): `ThemeChipStrip` (`全部 / All`, `海盗 / Pirate`…), `QuitConfirmDialog`, `HomeTabBody` group label, `DecorTabBody` toast, the shard help text, `GiftPackReveal`/`CardChestReveal` notes.

### 3.3 Reuse existing bilingual data
- Avatar themes: `THEME_DISPLAY_NAMES[t].{zh,en}` already exist — `ThemeChipStrip` already uses them. Any other theme label site reuses them.
- Pack display names: `getPackMeta(slug).displayNameZh/displayNameEn` already bilingual.

---

## 4. Files

**New**
- `src/lib/i18n/bilingual.ts` (`bi(zh,en)`) + a tiny test.

**Modified (known)**
- `src/components/play/KidNavBar.tsx` — bilingual tab labels (TabDef gains nothing; `label` becomes `背包 / Bag`), font + width tweak, gear aria-label.
- `src/components/shop/ShopCategoryTabs.tsx` — bilingual category labels + aria-label.
- `src/components/shop/ShopItemCard.tsx` — bilingual rarity + price aria-label.
- **Plus** whatever the sweep turns up across `src/components/{play,shop,scenes,home}` and `src/app/play/**` (the plan will enumerate the exact files after a grep pass).
- `CLAUDE.md` — note the bilingual convention + `bi()` helper as the standard.

**No DB change, no migration, no recompile.**

---

## 5. Out of scope
- A real i18n/localization framework or language toggle (locked: bilingual side-by-side, no toggle).
- Translating AI-generated content (story chapters, scene text) or collectible card names (already bilingual).
- Parent-facing `/parent` admin screens (David-facing, not the kid surface) — unless trivially adjacent.
- The avatar try-on redesign (separate spec).

---

## 6. Testing
- `bi()` returns `"中文 / English"`.
- `KidNavBar`: every tab label contains both a CJK char and an ASCII letter (regex assert over the rendered tab labels) — a guard that catches future single-language regressions.
- `ShopCategoryTabs`: same bilingual assertion over all 6 tabs.
- `ShopItemCard`: rarity label renders bilingual.
- A lightweight **lint-style test** (`tests/unit/bilingual-chrome.test.tsx`) that renders the nav + category tabs and asserts no label is single-language (no CJK-only, no ASCII-only) — the regression net.

---

## 7. Done criteria
- Bottom nav + shop category tabs + shop rarity + every swept label are bilingual `中文 / English`.
- Nothing kid-facing in the chrome is single-language; the bilingual regression test passes.
- `pnpm typecheck && lint && test && build` green.
