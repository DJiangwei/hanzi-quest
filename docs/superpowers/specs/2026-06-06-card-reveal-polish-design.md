# Post-Reveal Card Polish — Design Spec

**Date:** 2026-06-06
**Status:** approved (design)
**Context:** Since PR #52, every card grant (boss clear, perfect week, weekly 大礼包) is awarded automatically but surfaced weakly: boss-clear shows a tiny "🎴 新卡片！" banner in `LevelFanfare`, the 大礼包 uses a flat `GiftPackReveal`, and perfect-week is silent (fire-and-forget). The rich `TreasureChestReveal` component (chest shake→open→reveal) was kept but is unused after the boss PR removed the old chest button. This PR unifies all card grants into one satisfying **tap-to-open chest reveal**.

Third of David's three requested PRs (boss animations ✅, map UI ✅).

---

## 1. North Star

> When Yinuo earns a card — beating a boss, completing a perfect week, or hitting her weekly check-in 大礼包 — a treasure chest appears. She taps it, it shakes and bursts open, and her new card flies out with its name and lore. Multiple cards = multiple chests to open.

---

## 2. Locked decisions

- **Tap-to-open chest** (not auto-reveal) — the kid taps the chest to open it.
- **All three sources** get the chest reveal: boss-clear, perfect-week, weekly 大礼包.
- Reuse/extend the existing **`TreasureChestReveal`** visual; unify into one queue component.
- **Sequential chests** for multi-card grants (e.g. the 5-card 大礼包 = tap through 5 chests).
- No DB schema change (richer SELECTs only), no recompile.

---

## 3. Data threading — close the gap

`CardGrantResult` (`pullCardInTx`) and `GiftCard` (`grantGiftPackInTx`) currently return only `{itemId, packId, packSlug, isDupe, shardsAfter}`. The reveal needs the card's display fields. Both functions already `SELECT` the catalog from `collectibleItems`; extend the select + the returned shape with:

```ts
slug: string;
nameZh: string;
nameEn: string;
loreZh: string | null;
loreEn: string | null;
```

So a granted card carries everything the reveal needs except the emoji, which is resolved **in the component** (client-safe) via `getPackMeta(packSlug).resolveRevealEmoji?.(slug) ?? getPackMeta(packSlug).themeEmoji`.

Define a shared client-safe type:
```ts
// e.g. src/lib/play/reveal-card.ts (pure)
export interface RevealCard {
  id: string;          // itemId
  slug: string;
  packSlug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  isDupe: boolean;
  shardsAfter: number;
}
```
Both `CardGrantResult` and `GiftCard` become supersets of (or map cleanly to) `RevealCard`.

---

## 4. `CardChestReveal` component

New `src/components/scenes/fx/CardChestReveal.tsx` (`'use client'`), built from the existing `TreasureChestReveal` internals:

**Props:** `{ cards: RevealCard[]; onDone: () => void }`.

**Behavior:**
- Renders a queue: shows card `index` of `cards`. For each card:
  - Closed chest → user taps **"开启宝箱 / Open"** → `shake` (~0.8s) → `open` (~0.6s) → `reveal`.
  - Reveal shows: the card glyph — `ZodiacIcon` when `slug` is a zodiac slug, else the resolved emoji (large); `nameZh` + `nameEn`; lore (`loreZh`/`loreEn`) if present; and a dupe note "+1 🔹 碎片 / shard (now N)" when `isDupe`.
  - Button: if more cards remain → **"下一个 / Next"** (advances to the next closed chest); on the last → **"继续 / Continue"** → `onDone()`.
- Reduced motion: start each card at `reveal` (no shake/open); still tap-through.
- `playSound('fanfare')` on open (as `TreasureChestReveal` does), respecting reduced motion.
- A small progress dot row ("1/5") when `cards.length > 1`.

`TreasureChestReveal` is refactored: either `CardChestReveal` reuses its chest+reveal sub-rendering, or `TreasureChestReveal` is generalized to take a `RevealCard` + emoji-resolution and `CardChestReveal` wraps it with the queue. Implementer's call; keep one chest visual.

---

## 5. Surfacing all three sources

### 5.1 Boss clear + perfect week (`finishLevelAction`, `play.ts`)
- Boss-clear card is already awaited (`cardGrant = await pullCardForChild('boss_clear', sessionId)`).
- **Change perfect-week from fire-and-forget to awaited**: capture `const perfectCard = await pullCardForChild('perfect_week', weekId)` (was `pullCardForChild(...).catch(...)`). *(Updates the landmine — small added latency on a perfect boss-clear, worth it to reveal the card.)*
- Return a single ordered list: `cardGrants: RevealCard[]` = `[bossCard?, perfectCard?]` filtered to the ones that actually `granted` (skip cap-reached / already-granted / not-due). Keep the existing `bonuses`/`trophies`/`freePullClaimed` return fields; the old single `cardGrant` field is replaced by `cardGrants` (update consumers).

### 5.2 Weekly 大礼包 (`finishAttemptAction` → `claimWeeklyGiftIfDue`)
- `claimWeeklyGiftIfDue` already returns `{ cards }`; with §3, those `GiftCard`s carry the display fields → map to `RevealCard[]`. The `finishAttemptAction` return's `giftPack` field carries them.

### 5.3 `SceneRunner`
- Maintain a single **reveal queue** state. After `finishAttemptAction`, enqueue `result.giftPack?.cards`. After `finishLevelAction`, enqueue `levelResult.cardGrants`. Render `<CardChestReveal cards={queue} onDone={() => setQueue([])} />` in the fanfare/overlay layer.
- Remove the tiny `cardGrant` banner path from `LevelFanfare` (the chest reveal replaces it). `LevelFanfare` keeps the "Boss defeated!" heading + coins + 回地图; the card is now shown by `CardChestReveal`, not the banner.
- Retire `GiftPackReveal` (replaced by `CardChestReveal`). Keep the file only if a test references it; otherwise delete.

---

## 6. Out of scope

- No new card sources or economy changes (cap/shard logic untouched).
- No per-pack bespoke chest art (one shared chest; the card glyph differentiates).
- No schema change (only added SELECT columns + returned fields).
- Story-chapter card grants (none exist as a separate reveal today) — unchanged.

---

## 7. Testing

- **`card-chest-reveal.test.tsx`**: single card → open → reveal shows name/emoji; multi-card → "Next" advances through all then "Continue" calls `onDone`; dupe → shard note; reduced-motion → starts at reveal; zodiac slug → ZodiacIcon path, non-zodiac → emoji path.
- **grants**: `pullCardInTx` + `grantGiftPackInTx` results include `slug/nameZh/nameEn/loreZh/loreEn` (extend existing `tests/unit/grants-db`/`grant-gift-pack`/`pull-card-for-child` fixtures).
- **`finishLevelAction`**: returns `cardGrants` array; includes the perfect-week card when due (awaited); excludes non-granted.
- **`SceneRunner`**: enqueues gift cards (from attempt) and boss/perfect cards (from level) into the reveal; renders `CardChestReveal`.
- Update existing `LevelFanfare` / `scene-runner-*` / `gift-pack-reveal` tests for the banner→chest change (the cap-reached banner message may move into the reveal or be dropped).

---

## 8. Files

**New**
- `src/lib/play/reveal-card.ts` — `RevealCard` type.
- `src/components/scenes/fx/CardChestReveal.tsx`.
- tests per §7.

**Modified**
- `src/lib/db/grants.ts` — extend `CardGrantResult` + `GiftCard` + their SELECTs/returns with display fields.
- `src/lib/actions/gacha.ts` — `pullCardForChild`/`claimWeeklyGiftIfDue`/`grantGiftPackInTx` result types flow the new fields.
- `src/lib/actions/play.ts` — `finishLevelAction` awaits perfect-week, returns `cardGrants: RevealCard[]`.
- `src/components/scenes/SceneRunner.tsx` — reveal queue; mount `CardChestReveal`; drop banner/GiftPackReveal wiring.
- `src/components/scenes/fx/LevelFanfare.tsx` — remove the card banner (keep heading/coins/回地图).
- Possibly generalize `src/components/scenes/fx/TreasureChestReveal.tsx`.
- `CLAUDE.md` — PR entry + landmine updates (perfect_week now awaited; unified reveal).

**Deleted (if unreferenced)**
- `src/components/play/GiftPackReveal.tsx` + its test (replaced).

---

## 9. Build flow

spec → plan → build (subagent TDD) → four-green gate → optional local-dev styling glance → PR + merge. No DB change, no recompile.

---

## 10. Done criteria

- Boss clear → tap a chest → card reveals with name/lore; a perfect boss-clear reveals two chests (boss + perfect-week).
- Weekly 大礼包 → tap through one chest per card.
- Dupes show the shard note; reduced-motion still reveals (no animation).
- `pnpm typecheck && lint && test && build` green.
