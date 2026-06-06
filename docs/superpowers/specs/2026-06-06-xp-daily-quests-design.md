# XP Foundation + Daily Quests (Phase 1) — Design Spec

**Date:** 2026-06-06
**Status:** approved (design)
**Context:** The retention gap David flagged — "no daily reason to open the app; Yinuo needs prompting." This is **Phase 1** of the larger "Daily Quests + Season Pass" draft (`docs/superpowers/specs/2026-05-25-daily-quests-and-season-pass-design.md`). That draft predates ~30 PRs and is decomposed here: **PR-1 (this spec) = XP foundation + Daily Quests**; the **Season Pass is a separate later PR** (its draft stands, tuned from real usage data after this ships). Refreshed for the current product (PR #66).

**Core principle (unchanged from the draft):** purely **additive** — zero changes to existing loops/economy. XP and quest ticks are awarded *alongside* existing coin/card/trophy logic, fire-and-forget, never blocking or replacing them.

---

## 1. North Star

> Yinuo opens the app and sees **3 small things to do today**, each with a progress bar. Doing normal play fills them in; finishing all 3 pops a daily chest of coins. A growing **Level + title** next to her avatar rewards the long game. The whole thing rides on top of what she already does — no new chores.

---

## 2. Scope (Phase 1 only)

**In:** XP currency + `awardXp`; a cosmetic player Level + title; 8 daily-quest templates; per-child daily quest generation (3/day); progress ticking wired into existing actions; the all-3-done daily chest (coins + XP); the island-map quest row + level badge + XP/level-up toasts.

**Out (→ Season Pass PR or later):** season track/tiers, season-exclusive rewards, `season_xp`, functional level unlocks (pet/decor slots), level-up cinematic, weekly quests, recap screen.

---

## 3. XP foundation

### 3.1 XP sources (additive)

| Action | XP | Existing reward (untouched) |
|---|---|---|
| Scene completed (first clear) | +10 | +50 coins |
| Scene perfect (score 100) | +5 | +25 coins |
| Boss cleared | +50 | +300 coins + card |
| Each daily quest completed | +(quest XP, 15–30) | — |
| Daily chest (all 3 quests) | +30 | + 50–100 coins |
| 7-day streak milestone | +100 | +100 coins |

XP is a **separate currency** from coins — they never convert. (No XP for raw card grants; "earn a card" is rewarded via its quest.)

### 3.2 Player Level + title (cosmetic)

- `levelForXp(totalXp)` — a gentle curve `cumXp(L) = 50·(L−1) + 25·(L−1)·(L−2)` (L1=0, L2=50, L3=150, L4=300, L5=500, L6=750, L7=1050, L10=2250 …). Tunable; early levels come fast.
- **Title bands** (bilingual, tunable): L1–2 见习水手/Cabin Boy · L3–4 水手/Sailor · L5–7 副船长/First Mate · L8–11 船长/Captain · L12–15 航海家/Navigator · L16+ 海洋大师/Sea Master.
- Display: a small **Level badge + title** by the avatar on the island map. No functional unlocks in V1.

### 3.3 Schema (migration ~0022)

```sql
CREATE TABLE child_xp (
  child_id  uuid PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  total_xp  integer NOT NULL DEFAULT 0,
  level     integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only ledger (debugging + future analytics + idempotency anchor).
CREATE TABLE xp_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  amount     integer NOT NULL,
  source     text NOT NULL,   -- 'scene_complete'|'scene_perfect'|'boss_clear'|'daily_quest'|'daily_chest'|'streak_milestone'
  ref_id     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
(No `season_xp` — added with the Season Pass PR.)

### 3.4 `awardXp(childId, amount, source, refId?)`
Single write path (`src/lib/db/xp.ts`): insert `xp_events`; upsert `child_xp.total_xp += amount`; recompute `level = levelForXp(total_xp)`; return `{ totalXp, level, leveledUp }`. Pure `levelForXp` + title lookup live in a client-safe module (`src/lib/xp/levels.ts`) for the UI badge.

---

## 4. Daily Quests

### 4.1 Quest templates (`src/lib/quests/definitions.ts`, TS not DB)

| Key | 中文 | Requirement | target | XP |
|---|---|---|---|---|
| `complete_scenes` | 小小探险家 | Complete 3 scenes | 3 | 20 |
| `perfect_scores` | 完美之星 | Get 2 Perfect scores | 2 | 20 |
| `spend_coins` | 购物达人 | Spend 50 coins in the Shop | 50 | 20 |
| `earn_card` | 收藏家 | Earn 1 treasure card | 1 | 20 |
| `boss_clear` | Boss 猎人 | Win 1 Boss battle | 1 | 20 |
| `practice_scenes` | 练习生 | Complete 2 Practice scenes | 2 | 20 |
| `review_flashcards` | 复习时间 | View 3 Review flashcards | 3 | 15 |
| `full_level` | 大冒险家 | Finish a full level in one session | 1 | 30 |

(`earn_card` replaces the obsolete coin-gacha quest — ticked by any card grant: boss/perfect/大礼包.) Each definition has an emoji + bilingual short label + `feasible(ctx)` predicate (e.g. `boss_clear` needs a boss unlocked this week; `spend_coins` always feasible — teaches saving).

### 4.2 Generation
On first play-layout mount per UTC day, if no `daily_quests` rows exist for `(childId, today)`: pick **3** from the pool, filtered by `feasible`, excluding yesterday's 3 keys, then insert. Deterministic-enough random (no re-rolls — decision fatigue is worse for a 6yo). Generation is idempotent (UNIQUE `(childId,date,questId)` + a guard so concurrent mounts don't double-insert).

### 4.3 Schema (same migration ~0022)
```sql
CREATE TABLE daily_quests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  date       text NOT NULL,           -- UTC YYYY-MM-DD
  quest_id   text NOT NULL,           -- definition key
  progress   integer NOT NULL DEFAULT 0,
  target     integer NOT NULL,
  completed  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, date, quest_id)
);

-- One row per child per day once the all-3 chest is claimed (idempotency).
CREATE TABLE daily_quest_chests (
  child_id   uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  date       text NOT NULL,
  coins      integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, date)
);
```

### 4.4 Progress ticking
`tickQuestProgress(childId, questKey, amount)` (`src/lib/db/quests.ts`): if a today's row for `questKey` exists and `!completed`, `progress = min(progress+amount, target)`; if it reaches target, set `completed=true` and `awardXp(childId, questXp, 'daily_quest', questRowId)`. Returns whether it just completed (for a toast). No-op if the child doesn't have that quest today. **Fire-and-forget** from callers (after primary writes; failure never blocks).

### 4.5 Daily chest
When all 3 of today's quests are `completed`, the chest is **claimable**. `claimDailyChest(childId)` (server action, `requireChild`): verify all 3 complete + not already in `daily_quest_chests`; insert the chest row with a random 50–100 coins; `awardCoins(..., 'daily_chest')` + `awardXp(childId, 30, 'daily_chest')`; idempotent via the PK. Returns the coins for the reveal. Reuses the existing chest/`CardChestReveal`-style celebration (coins variant, not a card).

### 4.6 Integration points (all additive, fire-and-forget)

| Existing action | Added side-effect |
|---|---|
| `finishAttemptAction` (scene clear) | `awardXp(10,'scene_complete')`; `tickQuestProgress('complete_scenes',1)`; if Practice section → `tickQuestProgress('practice_scenes',1)`; if Review/flashcard → `tickQuestProgress('review_flashcards',1)` |
| `finishAttemptAction` (score 100) | `awardXp(5,'scene_perfect')`; `tickQuestProgress('perfect_scores',1)` |
| `finishLevelAction` (boss cleared) | `awardXp(50,'boss_clear')`; `tickQuestProgress('boss_clear',1)`; if full level → `tickQuestProgress('full_level',1)` |
| `purchaseShopItemInTx` | `tickQuestProgress('spend_coins', priceCoins)` |
| card-grant path (boss/perfect/大礼包) | `tickQuestProgress('earn_card', nCards)` |
| `tickStreak` (7-day milestone) | `awardXp(100,'streak_milestone')` |

The section (Practice/Review) is already known where `finishAttemptAction` runs (the section page passes it); thread the section/sceneType so the right quest ticks. `earn_card` ticks wherever `pullCardForChild`/gift grants succeed.

### 4.7 UI
- **`DailyQuestRow`** on the island map (`/play/[childId]`), below the avatar/coin/`MapHeaderPill`/`WeekStrip`, above the voyage board. A row of 3 `DailyQuestCard`s: emoji + short 中文 label + progress bar (`p/target`) + state (in-progress / ✓ done). When all 3 done → a **daily chest** button in/above the row; tap → coins reveal + `明日再来` afterward. When already claimed → "🎁 明日再来 / Come back tomorrow".
- **Level badge** + title near the avatar (server-rendered from `child_xp`, computed via `levelForXp`).
- **`XpGainToast`** (reuse `BonusToast` pattern) for `+XP` and a level-up toast on `leveledUp`, surfaced in `SceneRunner` alongside the existing bonus/trophy toasts.

---

## 5. Non-regression / overlap with existing systems

- **daily-login (+20 coins)**, **streak milestone (+100 coins)**, **card-economy-v2 weekly 大礼包 (5-of-7 check-ins)** all stay exactly as-is. XP is a *separate* currency layered on top — the streak milestone now *also* grants +100 XP (additive), no double coin pay.
- Quest ticks read from / write to NEW tables only; existing actions keep their current returns. Adding the ticks must not change any existing test's primary assertions (only add new side-effects, mocked in tests).
- All new writes are fire-and-forget after the primary DB writes; an XP/quest failure leaves the scene/level/purchase fully successful.

---

## 6. Files (estimate)

**New**
- migration ~0022 + schema (`src/db/schema/xp.ts`, `quests.ts`) — `child_xp`, `xp_events`, `daily_quests`, `daily_quest_chests`.
- `src/lib/xp/levels.ts` (pure: `levelForXp`, `titleForLevel`) + `src/lib/db/xp.ts` (`awardXp`).
- `src/lib/quests/definitions.ts` (templates) + `src/lib/db/quests.ts` (`generateDailyQuests`, `tickQuestProgress`, `getTodayQuests`, `claimDailyChest`) + `src/lib/actions/quests.ts` (server actions).
- `src/components/play/DailyQuestRow.tsx`, `DailyQuestCard.tsx`, `LevelBadge.tsx`, `XpGainToast.tsx`.
- Tests for each.

**Modified**
- `src/lib/actions/play.ts` (finishAttempt/finishLevel ticks + XP, thread section/sceneType), `src/lib/db/shop.ts` or the purchase tx (spend_coins tick), the card-grant path (earn_card tick), `src/lib/db/streaks.ts` (streak XP), `src/app/play/[childId]/page.tsx` (mount quest row + level badge + generate-on-mount), `SceneRunner` (XP/level toasts).
- `CLAUDE.md` — PR entry + landmines.

---

## 7. Testing

- `levelForXp` curve + `titleForLevel` bands (pure).
- `awardXp` upserts `child_xp`, writes a ledger row, recomputes level, reports `leveledUp`.
- `generateDailyQuests` picks 3 feasible, excludes yesterday, idempotent for the day.
- `tickQuestProgress` increments, caps at target, completes + awards quest XP once, no-ops for un-held quests.
- `claimDailyChest` requires all-3-done, idempotent (PK), awards coins+XP.
- Integration: `finishAttemptAction`/`finishLevelAction` fire the right ticks (mock the new fns; assert called — existing assertions unchanged).
- UI: `DailyQuestCard` states; `DailyQuestRow` renders 3 + chest when all done; `LevelBadge` shows level+title.

---

## 8. Build flow

spec → plan → build (subagent TDD) → four-green gate → optional local-dev glance → PR + merge. Migration ~0022 auto-applies on deploy.

---

## 9. Done criteria

- Each UTC day, the child gets 3 daily quests that fill from normal play; finishing all 3 yields a claimable coin chest (idempotent).
- XP accrues from scenes/boss/quests/streak; a Level + title shows by the avatar and ticks up.
- All existing loops/economy unchanged; new writes are additive + fire-and-forget.
- `pnpm typecheck && lint && test && build` green.
