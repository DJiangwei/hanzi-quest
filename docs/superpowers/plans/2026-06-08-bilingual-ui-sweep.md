# Bilingual UI Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every kid-facing UI chrome label bilingual `中文 / English`, with a `bi()` helper and a regression test that fails if a nav/category label is single-language.

**Architecture:** A tiny `bi(zh,en)` helper formats single-string labels. JSX that already stacks a ZH span + EN span (e.g. `SectionCard`, sound cards) is already bilingual and left alone. The sweep targets the enumerated single-language strings found by grep. A regression test renders the nav + shop category tabs and asserts each label has both a CJK char and an ASCII letter.

**Tech Stack:** Next.js 16, React 19, Tailwind, Vitest + RTL.

**Already-bilingual (DO NOT touch — verified):** `KidNavBar` QuitConfirmDialog, `SectionCard`/`WeekHub` (titleZh+titleEn), `TrophiesBody` category labels (`{zh,en}`), `SceneRunner` segment labels (`{zh,en}`), `ThemeChipStrip`, `PowerupTray` skip dialog, sound cards' `nameZh / nameEn` line, `HomeTabBody` group label, `DecorTabBody` toast, `PackPageBody` shard help, `CardChestReveal`/`GiftPackReveal` notes.

**No DB change, no migration, no recompile.**

---

## File structure
- **New:** `src/lib/i18n/bilingual.ts` (`bi`), `tests/unit/bilingual-chrome.test.tsx` (regression net).
- **Modified:** `KidNavBar.tsx`, `ShopCategoryTabs.tsx`, `ShopItemCard.tsx`, `AtlasHub.tsx`, `HomeTabBody.tsx`, `SoundsTabBody.tsx`, `PetsTabBody.tsx`, `BossScene.tsx`, `TrophiesHallCard.tsx`, `CLAUDE.md`.

---

## Task 1: `bi()` helper

**Files:** Create `src/lib/i18n/bilingual.ts`; Test `tests/unit/bilingual.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/bilingual.test.ts
import { describe, expect, it } from 'vitest';
import { bi } from '@/lib/i18n/bilingual';

describe('bi', () => {
  it('joins zh + en as "中文 / English"', () => {
    expect(bi('背包', 'Bag')).toBe('背包 / Bag');
    expect(bi('商店', 'Shop')).toBe('商店 / Shop');
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/bilingual.test.ts` → FAIL (no module).

- [ ] **Step 3: Implement**

```ts
// src/lib/i18n/bilingual.ts
/** Join a Chinese + English label as "中文 / English" — the app-wide convention. */
export function bi(zh: string, en: string): string {
  return `${zh} / ${en}`;
}
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(i18n): bi(zh,en) bilingual label helper"`

---

## Task 2: KidNavBar bilingual tabs

**Files:** Modify `src/components/play/KidNavBar.tsx`

- [ ] **Step 1: Change the five tab `label` values** (in the `tabs` array):
  - map: `label: 'Map'` → `label: '地图 / Map'`
  - backpack: `label: '背包'` → `label: '背包 / Bag'`
  - calendar: `label: '日历'` → `label: '日历 / Calendar'`
  - home: `label: '家'` → `label: '家 / Home'`
  - shop: `label: '商店'` → `label: '商店 / Shop'`

- [ ] **Step 2: Shrink the label font + tighten tab** so `背包 / Bag` fits one line on a ~360px phone. In the label `<span>` (currently `text-xs ...`), change `text-xs` → `text-[10px] leading-tight whitespace-nowrap`. On the `<Link>`, change `min-w-14 ... px-2` → `min-w-[52px] ... px-1`.

- [ ] **Step 3: Gear aria-label** — change `aria-label="parent gear"` → `aria-label="设置 / Settings"`.

- [ ] **Step 4: Run** `pnpm vitest run tests/unit` (no break) + manual: `pnpm dev`, confirm the 5 tabs each show `中文 / English` on one line.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(i18n): bilingual bottom-nav tab labels"`

---

## Task 3: ShopCategoryTabs bilingual

**Files:** Modify `src/components/shop/ShopCategoryTabs.tsx`

- [ ] **Step 1: Bilingual category labels** (the `CATEGORIES` array `label` values):
  - `'装扮'` → `'装扮 / Looks'`, `'音效'` → `'音效 / Sounds'`, `'伙伴'` → `'伙伴 / Pets'`, `'装饰'` → `'装饰 / Decor'`, `'道具'` → `'道具 / Items'`, `'家具'` → `'家具 / Furniture'`.

- [ ] **Step 2: Other strings** — `即将上线` → `即将上线 / Coming soon`; `aria-label="商店分类"` → `aria-label="商店分类 / Shop categories"`. Use `text-[10px]` on the label span if it overflows (the strip scrolls horizontally, so wrapping is acceptable too).

- [ ] **Step 3: Run** typecheck + tests (no break).
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(i18n): bilingual shop category tabs"`

---

## Task 4: ShopItemCard rarity + state labels

**Files:** Modify `src/components/shop/ShopItemCard.tsx`

- [ ] **Step 1: Bilingual `RARITY_LABEL`:**

```tsx
const RARITY_LABEL: Record<string, string> = {
  common: '普通 / Common',
  rare: '稀有 / Rare',
  epic: '史诗 / Epic',
};
```
And the fallback `RARITY_LABEL[rarity] ?? '普通'` → `?? '普通 / Common'`.

- [ ] **Step 2: State labels** — `✓ 已装备` → `✓ 已装备 / Equipped`; `点击装备` → `点击装备 / Tap to equip`.

- [ ] **Step 3: Price aria-label** — `，价格 ${shopItem.priceCoins} 金币` → `，价格 ${shopItem.priceCoins} 金币 / ${shopItem.priceCoins} coins`.

- [ ] **Step 4: Run** typecheck + tests.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(i18n): bilingual shop item rarity + state labels"`

---

## Task 5: AtlasHub (Backpack hub)

**Files:** Modify `src/components/play/AtlasHub.tsx`

- [ ] **Step 1: Header + subtitle** — `<h1 ...>背包</h1>` → `背包 / Bag`; the subtitle `{totalOwned} / {totalItems} · 各种系列等你来收集！` → append EN: `… · 各种系列等你来收集！/ Collect them all!`

- [ ] **Step 2: Story-library card** (inlined) — `故事书` → `故事书 / Story Library`; `船长伊诺的航海日志。` → add EN on the next line/span `Captain Yinuo's voyage journal.`; `进入 →` → `进入 / Open →`.

- [ ] **Step 3: Run** typecheck + tests.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(i18n): bilingual Backpack hub + story card"`

---

## Task 6: Shop tab bodies (Home / Sounds / Pets)

**Files:** Modify `src/components/shop/{HomeTabBody,SoundsTabBody,PetsTabBody}.tsx`

- [ ] **Step 1: HomeTabBody** — `'购买失败'` → `'购买失败 / Purchase failed'`; `'即将上线'` → `'即将上线 / Coming soon'`; the footprint badge `${w}×${h} 格` / `'1×1 格'` → `${w}×${h} 格 / cells` and `1×1 格 / cell`.

- [ ] **Step 2: SoundsTabBody** — `actionLabel = '已装备'` → `'已装备 / Equipped'`. Make descriptions bilingual: the default card `description="经典的探险音效。"` → `"经典的探险音效。/ Classic adventure sound effects."`; and for the themed sound cards (where `description` is built from a ZH string), append ` / <EN>` for each (music-box: `音乐盒般的清脆叮当。/ Crisp music-box chimes.`; retro-arcade: `复古街机的电子音。/ Retro 8-bit arcade blips.`; nautical: `航海铃铛与海浪声。/ Sea bells and ocean waves.`; fanfare-plus: `更长的胜利号角。/ A longer victory fanfare.`). Match each to the actual themes present in the file; if a description string differs, append a sensible bilingual EN equivalent.

- [ ] **Step 3: PetsTabBody** — `actionLabel = '已装备'` → `'已装备 / Equipped'`.

- [ ] **Step 4: Run** typecheck + tests.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(i18n): bilingual shop tab bodies (home/sounds/pets)"`

---

## Task 7: BossScene + TrophiesHallCard chrome

**Files:** Modify `src/components/scenes/BossScene.tsx`, `src/components/play/TrophiesHallCard.tsx`

- [ ] **Step 1: BossScene lose-screen** — `海怪赢了这局！` → keep ZH and add an EN line under it (`The sea beast won this round!`); `你的勇气未变，重新再战吧。` → add EN (`Your courage is unshaken — fight again.`); the retry button `⚓ 再战 (免费)` → `⚓ 再战 (免费) / Fight again (free)`. (Render EN as a second `<span className="block text-sm opacity-80">` beneath each ZH line, consistent with other bilingual screens.)

- [ ] **Step 2: TrophiesHallCard** — `收集你的每一项成就。` → add EN (`Collect every achievement.`); `进入 →` → `进入 / Open →`; `aria-label={`荣誉殿堂 进度 ${pct}%`}` → `荣誉殿堂 / Trophy Hall 进度 ${pct}%`.

- [ ] **Step 3: Run** typecheck + tests.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(i18n): bilingual boss lose-screen + trophy hall card"`

---

## Task 8: Bilingual regression test + final grep sweep + docs

**Files:** Create `tests/unit/bilingual-chrome.test.tsx`; Modify `CLAUDE.md`

- [ ] **Step 1: Regression test** — render the nav + category tabs and assert every label is bilingual (has a CJK char AND an ASCII letter):

```tsx
// tests/unit/bilingual-chrome.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/play/c1',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/play/MidSceneProvider', () => ({
  useMidScene: () => ({ midScene: false }),
}));

import { KidNavBar } from '@/components/play/KidNavBar';

const hasCJK = (s: string) => /[一-鿿]/.test(s);
const hasLatin = (s: string) => /[A-Za-z]/.test(s);

describe('bilingual chrome', () => {
  it('every bottom-nav tab label is bilingual (CJK + Latin)', () => {
    render(<KidNavBar childId="c1" />);
    const nav = screen.getByLabelText('Kid navigation');
    const labels = Array.from(nav.querySelectorAll('a span'))
      .map((n) => n.textContent ?? '')
      .filter((t) => hasCJK(t) || /Map|Bag|Calendar|Home|Shop/.test(t));
    expect(labels.length).toBeGreaterThanOrEqual(5);
    for (const t of labels) {
      expect(hasCJK(t) && hasLatin(t), `single-language nav label: "${t}"`).toBe(true);
    }
  });
});
```

(If `ShopCategoryTabs` is trivially renderable without heavy mocks, add a parallel assertion over its 6 tabs; otherwise the nav assertion is the guard.)

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/bilingual-chrome.test.tsx` → PASS.

- [ ] **Step 3: Final grep sweep** — run:
```bash
grep -rnE "[一-鿿]" src/components/{play,shop,scenes,home} src/app/play \
  | grep -vE " / |Zh|En|font-hanzi|//|/\*"
```
Review each remaining hit. Fix any genuine single-language **kid-facing label** to `中文 / English` (skip `xxxZh`/`xxxEn` prop pairs, comments, and AI-content/card-name strings). Commit fixes as found.

- [ ] **Step 4: CLAUDE.md** — add under landmines:
> **Bilingual chrome is the rule.** Every kid-facing label (nav, tabs, buttons, headers, dialogs, selections) must be `中文 / English` — use `bi(zh,en)` from `@/lib/i18n/bilingual` for single-string labels, or a ZH-span + EN-span pair in JSX. `tests/unit/bilingual-chrome.test.tsx` fails if a nav label goes single-language. Card names + AI content are exempt (already bilingual / out of scope). Parent `/parent` admin is exempt.

- [ ] **Step 5: Four-green gate** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.

- [ ] **Step 6: Commit** `git add -A && git commit -m "test(i18n): bilingual-chrome regression net + CLAUDE.md"`

---

## Self-review (plan author)
- **Spec coverage:** §2 format (`中文 / English`, ZH-first) → all tasks; §3.1 helper → Task 1; §3.2 known gaps (nav/category/rarity) → Tasks 2-4; §3.2 sweep → Tasks 5-7 + Task 8 grep; §6 regression test → Task 8. Covered.
- **Placeholder scan:** the only rule-driven (non-literal) step is Task 8 §3 grep sweep — intentional safety net over a mechanical rule, backed by the regression test. All headline label changes are exact strings. SoundsTabBody descriptions (Task 6 §2) instruct matching the file's actual theme strings — acceptable since the EN equivalents are spelled out per theme.
- **Consistency:** `bi()` signature stable; `中文 / English` order consistent everywhere.
