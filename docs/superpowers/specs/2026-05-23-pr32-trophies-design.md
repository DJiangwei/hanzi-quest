# PR #32 — Achievements / Trophies

> **Author:** brainstormed with David, 2026-05-23.
> **Sibling:** picks up after PR #31 (sound themes, shipped 2026-05-23).
> **Status:** spec ready for implementation plan.

## Why

The economy currently rewards Yinuo with coins for every correct scene + boss clear, and she can spend coins on the Atlas (collection packs) and the Shop (avatar + sound themes). She has no **non-spend** sense of progress — no "look what I've done" moment. The original shop roadmap (`docs/superpowers/specs/2026-05-18-pr21-shop-expansion-design.md` §PR #27) called for an Achievements / Trophies system that pure-status, no-coin rewards. Now is the time: PR #30 + #31 added enough new mechanics (4 segments, 3 new scene types, sound themes) that a rich catalog has plenty of material to grant.

This PR delivers:

1. **20 trophies in 5 categories** (boss/mastery, streak, collection, coins, practice variety).
2. **Auto-grant infrastructure** — server-side `checkAndGrantTrophies(childId, context)` called from existing action endpoints. Idempotent via `(child_id, trophy_id)` PK + `ON CONFLICT DO NOTHING`.
3. **Standalone Trophies page** at `/play/[childId]/trophies`, entered via a 6th hall card on the Atlas Hub.
4. **Toast on grant** (mirrors `BonusToast` from PR #28) — trophy unlocks feel celebratory.
5. **One-off backfill script** — retroactively grants trophies Yinuo has already earned across her play history.

## Locked decisions (settled in brainstorm)

- **20 trophies at launch**, distributed across 5 categories (4 mastery, 3 streak, 5 collection, 3 coins, 4 practice variety + the 20th is `equip-sound-theme`).
- **Standalone trophies page** accessed via a 6th Atlas Hub hall card (rather than a top scroll strip on Atlas).
- **No coin reward.** Trophies are purely status/pride.
- **Auto-grant at action time.** Each relevant server action (boss clear, perfect week, coin award, pack-complete pull, scene-type-specific clear, sound theme equip) calls `checkAndGrantTrophies(childId, ...)` with the contextual check set.
- **Bilingual labels mandatory** (per `yinuo_english_native.md`). Every trophy renders zh + en side-by-side.
- **Locked-card UI shows silhouette + lore-redacted hint** — not a flat "?" — so Yinuo can see what's available to chase.
- **Backfill script runs once against prod after merge** to retroactively grant trophies already earned.

## Trophy catalog (20 total)

| # | Slug | Emoji | Name (zh / en) | Category | Condition |
|---|---|---|---|---|---|
| 1 | `first-boss` | 🐙 | 首战告捷 / First Voyage | mastery | Defeat your first kraken boss |
| 2 | `perfect-week` | ⭐ | 完美一周 / Perfect Week | mastery | Clear every level of a week with 100% on at least one attempt |
| 3 | `100-levels` | 💯 | 百关达人 / Centurion | mastery | Complete 100 levels |
| 4 | `500-levels` | 🏆 | 五百勇士 / Veteran | mastery | Complete 500 levels |
| 5 | `boss-trio` | 👑 | 海怪三连击 / Kraken Trio | mastery | Defeat the boss in 3 different weeks |
| 6 | `streak-7` | 🔥 | 一周打卡 / Week Streak | streak | 7-day login streak |
| 7 | `streak-14` | 🔥🔥 | 双周不停 / Fortnight Streak | streak | 14-day login streak |
| 8 | `streak-30` | 🔥🔥🔥 | 月度铁人 / Month Streak | streak | 30-day login streak |
| 9 | `collect-zodiac` | 🐉 | 十二生肖 / Full Zodiac | collection | Collect all 12 zodiac |
| 10 | `collect-flags` | 🚩 | 世界小队长 / Flag Champion | collection | Collect all 30 flags |
| 11 | `collect-sea` | 🐳 | 海洋探险家 / Sea Explorer | collection | Collect all 20 sea creatures |
| 12 | `collect-dinos` | 🦖 | 恐龙发掘者 / Dino Digger | collection | Collect all 15 dinosaurs |
| 13 | `collect-solar` | 🪐 | 太阳系导航员 / Solar Navigator | collection | Collect all 10 solar bodies |
| 14 | `coins-100` | 🪙 | 第一桶金 / First Coins | coins | Earn first 100 coins lifetime |
| 15 | `coins-1k` | 💰 | 千金达人 / Thousand Club | coins | Earn 1,000 coins lifetime |
| 16 | `coins-5k` | 💎 | 五千海盗 / Five-K Pirate | coins | Earn 5,000 coins lifetime |
| 17 | `first-pinyin-pick` | 🅰️ | 拼音小能手 / Pinyin Apprentice | practice | First pinyin_pick scored ≥100 |
| 18 | `first-translate-pick` | 🌐 | 双语小达人 / Bilingual Spark | practice | First translate_pick scored ≥100 |
| 19 | `first-sentence-cloze` | 📝 | 填字大师 / Cloze Master | practice | First sentence_cloze scored ≥100 |
| 20 | `equip-sound-theme` | 🎵 | 音效收藏家 / Sound Collector | practice | Equip your first non-default sound theme |

Lore (short bilingual blurb shown on the trophy card front, distinct from the description that powers the unlock UI) is generated procedurally — same pattern as collectible items.

## Schema

### New tables (drizzle migration `0008_*.sql`)

```sql
CREATE TYPE trophy_category AS ENUM ('mastery', 'streak', 'collection', 'coins', 'practice');

CREATE TABLE trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_zh TEXT NOT NULL,
  description_en TEXT NOT NULL,
  lore_zh TEXT,
  lore_en TEXT,
  emoji TEXT NOT NULL,
  category trophy_category NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX trophies_category_idx ON trophies(category, display_order);

CREATE TABLE child_trophies (
  child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  trophy_id UUID NOT NULL REFERENCES trophies(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, trophy_id)
);
CREATE INDEX child_trophies_child_idx ON child_trophies(child_id, earned_at);
```

Seeding the 20 trophies happens via `scripts/seed-trophies.ts` (idempotent by slug).

## Auto-grant infrastructure

### Central API

```ts
// src/lib/db/trophies.ts
export type TrophyCheckContext =
  | { kind: 'boss-clear'; weekId: string }
  | { kind: 'perfect-week'; weekId: string }
  | { kind: 'level-complete' }                      // increments toward 100/500
  | { kind: 'coin-award'; lifetimeEarned: number }
  | { kind: 'pack-complete'; packSlug: string }
  | { kind: 'scene-clear'; sceneType: string; score: number }
  | { kind: 'sound-theme-equip'; slug: string };

export async function checkAndGrantTrophies(
  childId: string,
  context: TrophyCheckContext,
): Promise<GrantedTrophy[]>;
```

Returns the list of newly-granted trophies (zero or more), so the caller can pipe them into the UI as toasts.

### Wiring

Each action calls `checkAndGrantTrophies` with the appropriate context AND threads the returned `GrantedTrophy[]` back to the SceneRunner via a **new parallel field** on the action result (`trophies: GrantedTrophy[]`), not by extending `EconomyBonus`. Rationale: `EconomyBonus` is coin-shaped (has `delta: number`); trophies are status-shaped (no delta). Forcing them into one discriminated union would touch every existing caller. Parallel arrays keep the existing PR #28 path untouched.

Touch list:
- `finishLevelAction` — on boss clear, pass `boss-clear`; on perfect-week confirmation, pass `perfect-week`; always pass `level-complete`.
- `awardCoinsInTx` — on lifetime growth past 100/1k/5k thresholds, pass `coin-award`.
- `pullPaid` (in `src/lib/actions/gacha.ts`) — on pack completion (owned count == pack size after the pull), pass `pack-complete`.
- `finishAttemptAction` — on scene clear with score 100 for a pinyin_pick / translate_pick / sentence_cloze, pass `scene-clear`.
- `equipSoundThemeAction` — on equip of a non-`null` non-`default` slug, pass `sound-theme-equip`.

### Idempotency

`child_trophies` PK is `(child_id, trophy_id)`. Insert uses `ON CONFLICT (child_id, trophy_id) DO NOTHING`. Re-running the same check is a no-op.

### Streak trophies

The existing `tickStreak()` in `src/lib/db/streaks.ts` returns `currentStreak`. After PR #28's milestone path completes, also call `checkAndGrantTrophies(childId, { kind: 'level-complete' })` and inside the trophies module pull the current streak via `getStreakState(childId)` — granting 7/14/30 trophies. (No new context type needed; trophy code does its own streak read.)

## UI

### Atlas Hub — 6th hall card

`src/components/play/AtlasHub.tsx` already lays out 5 hall cards. Add a 6th, slug `'trophies'`, label `荣誉殿堂 / Hall of Trophies`, that links to `/play/[childId]/trophies`. Style matches the existing cards (parchment-and-rope motif).

### `/play/[childId]/trophies/page.tsx`

Server component:
- Fetch all 20 trophies (ordered by `category, display_order`).
- Fetch this child's `child_trophies` (set of earned trophy ids + earned_at timestamps).
- Pass to a client `TrophiesBody` for rendering.

### `TrophiesBody.tsx`

Grid of trophy cards. Each card:
- **Earned**: full color, emoji prominent, zh + en name, lore blurb, "获得于 YYYY-MM-DD" date stamp.
- **Locked**: greyscale silhouette of the emoji (CSS `filter: grayscale(1) opacity(0.4)`), `???` for the lore line, but description visible so Yinuo knows what to chase.

5 category sections (vertical), each with a header chip showing earned count / total. Total count at top.

### Trophy toast

A new `TrophyToast.tsx` (sibling of `BonusToast`), mounted alongside it in `SceneRunner`. Same horizontal-chip animation, distinct gold border, displays trophy emoji + bilingual name + "Trophy Unlocked!" line. Driven by a parallel `activeTrophies` state in SceneRunner. Respects `useReducedMotion`.

## Backfill

`scripts/backfill-trophies.ts` (idempotent):

For each child:
- Read total levels completed → grant `100-levels` / `500-levels` if reached.
- Read lifetime coins earned → grant `coins-100` / `coins-1k` / `coins-5k` if reached.
- For each pack → if all items owned, grant `collect-*`.
- Scan past `scene_attempts` for any pinyin_pick / translate_pick / sentence_cloze with score=100 → grant `first-*-pick`.
- Scan past `scene_attempts` for any boss clear (`won=true`) → grant `first-boss`; count distinct weeks → grant `boss-trio` if ≥3.
- Read current `streaks` table → grant `streak-7/14/30` based on `longestStreak`.
- Scan past `scene_attempts` aggregated per week — if all levels of any week have score=100, grant `perfect-week`.
- If `child_settings.sound_theme_slug` is non-null and non-`default` → grant `equip-sound-theme`.

Pattern matches `scripts/recompile-all-weeks.ts`: `loadEnv` first, dynamic import db inside `main()`, run for all children, print summary.

## Scope

### In scope

- 2 new tables + 1 new enum (drizzle 0008).
- `src/db/schema/trophies.ts`.
- `src/lib/db/trophies.ts` (CRUD + `checkAndGrantTrophies`).
- `src/lib/actions/trophies.ts` ('use server' — currently just a thin re-export wrapping `checkAndGrantTrophies` for use from client components if needed; otherwise the wiring is server-side only via existing actions).
- Auto-grant wiring in: `finishLevelAction`, `finishAttemptAction`, `awardCoinsInTx`, `pullPaid`, `equipSoundThemeAction`. Each action result gains a `trophies: GrantedTrophy[]` parallel field.
- New `TrophyToast.tsx` rendered alongside `BonusToast` in `SceneRunner`.
- Atlas Hub: 6th hall card.
- New page `src/app/play/[childId]/trophies/page.tsx`.
- New component `src/components/play/TrophiesBody.tsx` (client) + sub-components if needed (`TrophyCard.tsx`, `TrophyCategorySection.tsx`).
- Seed script `scripts/seed-trophies.ts` (20 trophies, idempotent).
- Backfill script `scripts/backfill-trophies.ts`.
- Tests: trophy schema, `checkAndGrantTrophies` per context kind, backfill helpers, TrophiesBody rendering (earned vs locked), BonusToast trophy variant.

### Out of scope (explicit deferrals)

- Pet companion, decorations, powerups — still queued for later PRs.
- Trophy sharing / social features.
- Trophy-tied avatar items or other unlocks (could come later — currently trophies are pure status).
- A "claim reward" UX — trophies are auto-granted, not redemption-style.
- Trophy progress bars showing partial progress toward locked trophies (e.g., "57 / 100 levels"). Would be nice; defer to follow-up. Locked cards just show the description.
- Per-category icons for the Atlas Hub hall card — use a single 🏆 emoji like the per-pack themeEmoji pattern.

## Code map

### New files
- `src/db/schema/trophies.ts` — Drizzle tables + enum.
- `src/lib/db/trophies.ts` — `listAllTrophies`, `listEarnedTrophies(childId)`, `checkAndGrantTrophies`.
- `src/lib/actions/trophies.ts` — `'use server'`, if any client-callable surface emerges. Probably empty at launch.
- `src/components/play/TrophiesBody.tsx`.
- `src/components/play/TrophyCard.tsx`.
- `src/app/play/[childId]/trophies/page.tsx`.
- `scripts/seed-trophies.ts`.
- `scripts/backfill-trophies.ts`.
- Tests: `tests/unit/trophies-db.test.ts`, `tests/unit/check-and-grant-trophies.test.ts`, `tests/unit/trophies-body.test.tsx`, `tests/unit/bonus-toast-trophy.test.tsx`, `tests/unit/backfill-trophies.test.ts`.

### Modified
- `src/db/schema/index.ts` — re-export trophies module.
- `src/lib/actions/play.ts` — `finishAttemptAction` + `finishLevelAction` call `checkAndGrantTrophies`, return granted trophies in `bonuses[]`.
- `src/lib/db/coins.ts` — `awardCoinsInTx` calls `checkAndGrantTrophies` on lifetime threshold cross.
- `src/lib/actions/gacha.ts` — `pullPaid` calls `checkAndGrantTrophies` on pack completion.
- `src/lib/actions/settings.ts` — `equipSoundThemeAction` calls on non-default equip.
- `src/lib/actions/play.ts` — `finishAttemptAction` + `finishLevelAction` return shape gains `trophies: GrantedTrophy[]` parallel field. `EconomyBonus` interface untouched.
- `src/components/play/BonusToast.tsx` — untouched.
- `src/components/scenes/SceneRunner.tsx` — collect granted trophies + mount `<TrophyToast>` sibling.
- `src/components/play/AtlasHub.tsx` — add 6th hall card.
- `CLAUDE.md` — bump + PR #32 bullet + 6th "hall" in current state.

## Verification

Before opening PR:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev` walkthrough:
   - Open Atlas Hub → see 6th 荣誉殿堂 card.
   - Tap it → trophies page renders with all 20 cards (most locked).
   - Complete a level → if level count crosses 100, see toast + card flips to earned.
   - Buy + equip a sound theme → toast for `equip-sound-theme`.
3. After merge: run `pnpm tsx scripts/seed-trophies.ts` then `pnpm tsx scripts/backfill-trophies.ts` against prod. Verify Yinuo's trophy count in the UI matches expectations (she should have ~10 of 20 already — first-boss, perfect-week, first-pinyin/translate/cloze, streak-7, coins-100, coins-1k, equip-sound-theme, maybe collect-zodiac).

## Open follow-ups (not blocking)

- Progress bars on locked trophy cards (e.g., "67 / 100 levels"). UX-positive, defer.
- Trophy-grant fanfare on the boss-clear / perfect-week paths (extra animation beyond the toast). Defer.
- A "next trophy to chase" hint widget on the island map header. Defer.
- Trophy-tied rewards (e.g., earning `collect-zodiac` unlocks a free zodiac-themed avatar background). Out of scope; trophies stay pure status at launch.

## Memory I'll write after PR #32 ships

- Update `CLAUDE.md` "Current state" line with the new trophies surface + the 6-hall Atlas.
- No `EconomyBonus` landmine since trophies are wired as a parallel field, not a refactor.
