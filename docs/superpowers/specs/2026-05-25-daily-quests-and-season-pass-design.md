# Daily Quests + Season Pass — Design Spec

**Date:** 2026-05-25
**Status:** draft
**Context:** hanzi-quest has shipped PRs #1–#37. The product is end-to-end playable with a rich economy (coins, 5 shop tabs, 5 collection packs, 20 trophies, streaks, powerups, pet, decor). The gap: no daily "why open the app" hook. Yinuo hasn't built a habit yet. This spec adds two new incentive layers on top of the existing loops — without modifying any current mechanic.

---

## 1. North Star

> Yinuo opens the app, sees 3 concrete things to do today, does them, gets a reward, and naturally flows into learning. Over weeks, a themed season gives every action a bigger purpose — a reward track she can see filling up.

---

## 2. Architecture overview

```
                        ┌──────────────────────────┐
                        │   Season Pass (6–8 weeks) │  NEW: long-term goal layer
                        │   themed reward track     │
                        │   exclusive avatar / pet  │
                        └──────────┬───────────────┘
                                   │ XP from all actions
                        ┌──────────▼───────────────┐
                        │   Daily Quests (3/day)    │  NEW: daily hook layer
                        │   "Complete 3 scenes"     │
                        │   "Get 2 Perfect scores"  │
                        │   → daily chest reward    │
                        └──────────┬───────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │           EXISTING LOOPS (untouched)                │
        │  Scene → Level (14 scenes) → Week Hub → 10-island   │
        │  Coins + Shop + Gacha + Trophies + Pet + Decor      │
        └─────────────────────────────────────────────────────┘
```

**Key principle:** zero changes to existing loops. Daily quests and season XP are awarded *alongside* existing coin/trophy logic, never instead of it.

---

## 3. XP / Level system (shared foundation)

Both daily quests and the season track need a shared "progress currency." XP is that currency.

### 3.1 XP sources

| Action | XP | Notes |
|---|---|---|
| Scene completed (first time) | +10 | On top of existing +50 coins |
| Scene perfect (all correct) | +5 bonus | On top of existing +25 coin bonus |
| Boss cleared | +50 | On top of existing +300 coins + free pull |
| Daily quest completed (each) | +20 | See §4 |
| Daily chest (all 3 quests done) | +30 bonus | In addition to per-quest XP |
| Streak milestone (7-day) | +100 | On top of existing +100 coins |

XP is **additive** — the existing coin economy is untouched. Coins buy shop items; XP progresses the season track. They never convert into each other.

### 3.2 Player level (cosmetic, persistent)

XP also feeds a simple player level displayed on the island map:

| Level | Total XP | Unlocks |
|---|---|---|
| 1 | 0 | — |
| 2 | 100 | — |
| 3 | 250 | — |
| 5 | 500 | Pet speech bubble slot 2 |
| 10 | 1,500 | — |
| 15 | 3,000 | Decor slot +1 |

Level is purely cosmetic prestige — a number next to the avatar. Level-up thresholds follow a gentle quadratic curve so early levels come fast and later ones stretch out. Unlocks are minor (extra speech bubble, extra decor slot) to avoid paywall feel.

### 3.3 Schema

```sql
-- New table: child_xp
CREATE TABLE child_xp (
  child_id TEXT PRIMARY KEY REFERENCES child_profiles(id),
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  season_xp INTEGER NOT NULL DEFAULT 0,  -- XP earned THIS season (resets each season)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New table: xp_events (append-only ledger, for debugging + future analytics)
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id TEXT NOT NULL REFERENCES child_profiles(id),
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,  -- 'scene_complete', 'scene_perfect', 'boss_clear', 'daily_quest', 'daily_chest', 'streak_milestone'
  ref_id TEXT,           -- optional: scene_attempt_id, quest_id, etc.
  season_id TEXT,        -- which season this XP counted toward
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`awardXp(childId, amount, source, refId)` is the single write path. It:
1. Inserts into `xp_events` (tagged with the active season_id if one exists)
2. Updates `child_xp.total_xp += amount` and `child_xp.season_xp += amount`
3. Recalculates level from `total_xp`
4. If an active season exists, recomputes `child_season_progress.current_tier` from `child_xp.season_xp` against the season's `tier_config` thresholds
5. Returns `{ newLevel, leveledUp, seasonXp, newTier }` so callers can trigger level-up and tier-up animations

The function derives the active season_id internally (via `getActiveSeason()`) — callers don't pass it.

---

## 4. Daily Quests

### 4.1 Quest pool

8 quest templates defined in TS (`src/lib/quests/definitions.ts`), not in the DB:

| # | Key | Name | Requirement | XP |
|---|---|---|---|---|
| 1 | `complete_scenes` | 小小探险家 | Complete 3 scenes | 20 |
| 2 | `perfect_scores` | 完美之星 | Get 2 Perfect scores | 20 |
| 3 | `spend_coins` | 购物达人 | Spend 50 coins in the Shop | 20 |
| 4 | `gacha_pull` | 收藏家 | Open 1 treasure chest (gacha pull) | 20 |
| 5 | `boss_clear` | Boss 猎人 | Complete 1 Boss battle | 20 |
| 6 | `practice_scenes` | 练习生 | Complete 2 scenes in the Practice section | 20 |
| 7 | `review_flashcards` | 复习时间 | View 3 flashcards in the Review section | 15 |
| 8 | `full_level` | 大冒险家 | Complete a full level (all scenes in one session) | 30 |

### 4.2 Generation rules

- Each day at first play-layout mount, check `daily_quests` for today's UTC date.
- If none exist: randomly pick 3 from the pool, weighted toward quests the child can actually do (e.g., skip "Boss 猎人" if no boss is unlocked this week; skip "收藏家" if balance < pull cost).
- Insert 3 rows into `daily_quests`.
- Quests never repeat on consecutive days (simple exclusion of yesterday's 3).
- No re-rolls. What you get is what you get — decision fatigue for a 6yo is worse than a slightly suboptimal quest.

### 4.3 Progress tracking

```sql
CREATE TABLE daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id TEXT NOT NULL REFERENCES child_profiles(id),
  date DATE NOT NULL,          -- UTC date this quest was assigned
  quest_id TEXT NOT NULL,      -- references quest definition key
  progress INTEGER NOT NULL DEFAULT 0,  -- current count toward target
  target INTEGER NOT NULL,     -- target count to complete
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  chest_claimed BOOLEAN NOT NULL DEFAULT FALSE,  -- has the all-3-done chest been claimed?
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, date, quest_id)
);
```

Progress is updated by a generic `tickQuestProgress(childId, questId, amount)` called from the same action handlers that already award coins. For example, `finishAttemptAction` already awards +50 coins — it will now also call `tickQuestProgress(childId, 'complete_scenes', 1)`.

### 4.4 Rewards

- **Per quest**: +20 XP on completion (auto-claimed when progress hits target)
- **All 3 done**: "Daily Chest" → 50–100 coins (random, uniformly distributed) + 30 bonus XP + a small visual celebration (chest opening animation, reusing existing gacha chest component)

### 4.5 UI

**Location:** Island map page (`/play/[childId]`), above the island nodes, below the avatar/coin bar.

**Design:** A horizontal row of 3 quest cards. Each card shows:
- Quest icon (emoji)
- Short Chinese label (e.g., "完成3个场景")
- Progress bar (e.g., 1/3 filled)
- Checkmark if completed, chest icon if claimable

**States:**
- Incomplete: washed-out, progress bar partially filled
- Completed (unclaimed): gold border, pulsing glow — tap to claim XP
- Claimed: green checkmark, faded
- All 3 claimed: daily chest appears in the center, tap to open (reuse existing treasure chest reveal animation)

**Edge cases:**
- If child hasn't played yet today → generate quests on first mount
- If child already completed all 3 and claimed chest → show "明日再来！" with a countdown to next refresh
- If child has 0 coins and gets "购物达人" → it's just a hard quest for that day; no special handling (teaches saving)

---

## 5. Season Pass

### 5.1 Concept

A themed 6–8 week season. Every XP earned during the season fills a tiered reward track. Free for all players — no paid tier. The season gives thematic coherence and a "limited-time" urgency that encourages regular play.

### 5.2 Season structure

- **Duration:** 8 weeks (aligns roughly with a school half-term)
- **Tiers:** 30 levels on the reward track
- **XP per tier:** starts at 50 XP, scales gently (50, 50, 75, 75, 100, 100, 125, 125, 150...). Tier 30 requires ~3,500 total XP.
- **Estimated pace:** A child playing 3–4 days/week and completing daily quests earns ~800–1,200 XP/week. Tier 30 is reachable in ~3–4 weeks of consistent play, leaving margin for casual players to reach tier 15–20.

### 5.3 First season: "夏季航海" (Summer Voyage)

| Tier | XP required (cumulative) | Reward |
|---|---|---|
| 1 | 50 | 100 coins |
| 2 | 100 | Season-themed avatar item (sailor hat variant) |
| 3 | 175 | 50 coins |
| 4 | 250 | 2× Hint powerup |
| 5 | 350 | Season-themed decor item (anchor) |
| 6 | 450 | 100 coins |
| 7 | 550 | 1× Streak Freeze |
| 8 | 675 | 200 coins |
| 9 | 800 | Season-themed pet accessory (parrot bandana) |
| 10 | 950 | Rare gacha pull token (夏季限定) |
| 11 | 1,100 | 150 coins |
| 12 | 1,250 | 2× Skip powerup |
| 13 | 1,400 | Season-themed avatar item (telescope) |
| 14 | 1,575 | 200 coins |
| 15 | 1,750 | Season-themed decor item (ship wheel) |
| 16 | 1,950 | 1× Streak Freeze |
| 17 | 2,150 | 250 coins |
| 18 | 2,350 | Season-themed sound theme (nautical variant) |
| 19 | 2,575 | Rare gacha pull token |
| 20 | 2,800 | Season-exclusive pet (dolphin calf variant) |
| 21–24 | 3,050–3,400 | Coins (300 each) |
| 25 | 3,500 | Epic gacha pull token (guaranteed new item) |
| 26–29 | 3,650–3,950 | Coins (400 each) |
| 30 | 4,100 | Grand prize: season-exclusive avatar set (captain's coat + hat) + animated "夏季航海大师" badge on profile |

### 5.4 Season lifecycle

```
Week 1–8:   Season active. Play → earn XP → climb tiers.
Week 9:     "Final week!" banner. All XP sources get a 1.5× multiplier
            (applied inside awardXp when within 7 days of season end).
Week 10:    Season ends. Rewards from claimed tiers are permanent.
            New season starts immediately (or 1-week off-season with
            reduced daily quest rewards).
```

**After season ends:**
- All claimed rewards remain in inventory permanently.
- Unclaimed tiers are lost — creates FOMO for next season.
- Season XP resets to 0. Total XP and level persist.
- A "season recap" screen shows: tiers reached, favorite quest, total coins earned.

### 5.5 Schema

```sql
-- New table: seasons
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,           -- slug: 'summer-voyage-2026'
  name_zh TEXT NOT NULL,         -- '夏季航海'
  name_en TEXT NOT NULL,         -- 'Summer Voyage'
  theme_emoji TEXT NOT NULL,     -- '⛵'
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  tier_config JSONB NOT NULL,    -- array of {tier, xp_required, rewards[]}
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New table: child_season_progress
CREATE TABLE child_season_progress (
  child_id TEXT NOT NULL REFERENCES child_profiles(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  current_tier INTEGER NOT NULL DEFAULT 0,
  tiers_claimed INTEGER[] NOT NULL DEFAULT '{}',  -- tiers where reward was claimed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (child_id, season_id)
);
```

### 5.6 UI

**Location:** New tab or card on the island map — a prominent "赛季" banner/button that opens the season track view.

**Season track view:** A vertical scrollable track showing 30 tiers. Each tier shows:
- Tier number
- Reward icon + name
- Locked (grey) / Available (teal glow) / Claimed (gold checkmark) state
- XP progress bar at the top: "当前等级 12 · 450/1,250 XP"

**Island map integration:** A compact banner below the daily quest row:
> "⛵ 夏季航海 · Tier 12/30 · 450 XP to next reward"

### 5.7 Reward grant dispatch

Season rewards span multiple item kinds (coins, avatar, pet, decor, powerups, sound themes, gacha tokens). The grant function `claimSeasonTierReward(childId, seasonId, tier)` dispatches by reward type — similar pattern to `purchaseShopItemInTx`'s switch dispatch (PR #34).

New reward types that need handling:
- **Gacha pull token** (`rare_pull_token`, `epic_pull_token`): a one-time free pull with guaranteed-rarity logic. Stored as a consumable in `powerup_inventory` with new `powerup_kind` values, or as a separate `pull_tokens` table. Prefer reusing `powerup_inventory` — add `rare_pull` and `epic_pull` to the `powerup_kind` enum.
- **Season-exclusive pet/avatar/decor items**: created as `shop_items` rows with a `season_id` column (NULL for regular items). Cannot be purchased with coins — only claimable via season track. Query filter: `WHERE season_id IS NULL OR season_id = '<current>'` so shop tabs don't show expired season items. Expired season items are hidden from shop but remain in inventory if already claimed.

---

## 6. Integration points (where existing actions get augmented)

| Existing action | New side effect |
|---|---|
| `finishAttemptAction` | `awardXp(childId, 10, 'scene_complete')` + `tickQuestProgress(childId, 'complete_scenes', 1)` |
| (same, when score=100) | `awardXp(childId, 5, 'scene_perfect')` + `tickQuestProgress(childId, 'perfect_scores', 1)` |
| `finishLevelAction` (boss) | `awardXp(childId, 50, 'boss_clear')` + `tickQuestProgress(childId, 'boss_clear', 1)` |
| `purchaseShopItemInTx` | `tickQuestProgress(childId, 'spend_coins', amount)` |
| `pullPaid` / free pull | `tickQuestProgress(childId, 'gacha_pull', 1)` |
| `tickStreak` (7-day milestone) | `awardXp(childId, 100, 'streak_milestone')` |

All new side effects are **fire-and-forget** — they don't block the main action's response. Use `Promise.all` or `await` them after the primary DB writes, not before. If XP/quest update fails, the scene attempt still succeeds (XP is non-critical).

---

## 7. UI component tree (new)

```
src/components/play/
├── DailyQuestRow.tsx          # Horizontal row of 3 quest cards (client component)
├── DailyQuestCard.tsx         # Single quest card: icon + label + progress bar + state
├── DailyChestOverlay.tsx      # Chest opening animation (reuses existing chest graphics)
├── SeasonBanner.tsx           # Compact banner on island map: "⛵ 夏季航海 · Tier 12/30"
├── SeasonTrackView.tsx        # Full scrollable 30-tier track (client component)
├── SeasonTierCard.tsx         # Single tier row: number, reward icon, state (locked/available/claimed)
├── SeasonRecapScreen.tsx      # End-of-season summary
├── XpGainToast.tsx            # Small XP popup (like BonusToast but shows +XP)
└── LevelUpOverlay.tsx         # Level-up celebration (reuse fanfare pattern)
```

### 7.1 New routes

| Route | Purpose |
|---|---|
| `/play/[childId]/season` | Full season track view |
| `/play/[childId]/season/recap` | End-of-season recap (only accessible during off-season) |

No changes to existing routes. The daily quest row mounts in the existing island map page. The season banner mounts below it.

---

## 8. Implementation phasing

### Phase 1: XP + Daily Quests (PR #38)

- `child_xp` + `xp_events` tables (migration 0014)
- `awardXp()` + `tickQuestProgress()` in `src/lib/db/xp.ts`
- Quest definitions in `src/lib/quests/definitions.ts`
- Quest generation on first play-layout mount
- `DailyQuestRow` + `DailyQuestCard` components
- Integration into `finishAttemptAction`, `finishLevelAction`, `purchaseShopItemInTx`, `pullPaid`, `tickStreak`
- Daily chest reward (coins + XP)
- Player level display on island map
- Tests

### Phase 2: Season Pass (PR #39)

- `seasons` + `child_season_progress` tables (migration 0015)
- Seed first season "夏季航海"
- `SeasonTrackView` + `SeasonBanner` + `SeasonTierCard` components
- `/play/[childId]/season` route
- Reward grant dispatch (claimSeasonTierReward)
- `rare_pull` + `epic_pull` powerup kinds
- Season-exclusive items (pet/avatar/decor with season_id)
- End-of-season handling (XP reset, recap screen)
- Tests

### Phase 3: Polish + Observe (PR #40+)

- Level-up animation
- Season recap screen
- Tuning pass after 2–4 weeks of Yinuo usage data
- Second season content planning

---

## 9. Edge cases

| Scenario | Handling |
|---|---|
| Child has no unlocked boss week | "Boss 猎人" excluded from daily pool |
| Child has < pull cost coins + gets "收藏家" | Quest stays; teaches saving; no special handling |
| Child doesn't play for 3 days | Quests from missed days are lost (no backlog); today's 3 are fresh |
| Child plays at 23:55 UTC, finishes at 00:05 | Quest progress counts toward the date the quest was *generated*; quest generation checks date at mount time |
| Season ends mid-session | Season XP counter freezes at `ends_at`; XP still goes to total_xp but stops contributing to season track |
| Multiple children on same device | Quest rows are per-child; switching children re-fetches |
| Child claims season reward, then season is extended | No impact — claimed rewards stay claimed; new tiers are added at the top |
| Gacha pull token: no unowned items left in pack | Fall back to coins (300 for rare, 600 for epic) |

---

## 10. Non-goals

- **Paid battle pass**: no real-money transactions. This is a kids' learning app.
- **Quest re-rolls**: decision fatigue reduction > flexibility.
- **Push notifications**: Yinuo is 6. App-usage habit should come from pull (fun), not push.
- **Weekly quests**: daily is enough for V1. Weekly can be added later if daily proves successful.
- **Season leaderboard**: anti-goal per GAME-DESIGN §9.
- **XP decay / inactivity penalty**: never punish a 6-year-old for not playing.

---

## 11. Open questions

1. **Should daily quests be the same for all children in a pack, or per-child random?** Per-child random is the spec above. Shared quests could be fun if Yinuo has classmates also using the app, but introduces coordination complexity. Revisit when there are >3 active children.
2. **Season duration: 8 weeks or align to school half-terms?** 8 weeks is simpler to build. Aligning to actual school calendar requires a parent-facing config. Start with 8 weeks; add calendar alignment in a later season.
3. **Should season-exclusive items ever return?** Simplest answer: no. They're gone after the season ends. This maximizes FOMO and makes each season feel special. If David changes his mind later, a "season vault" (buy old items with coins at a premium) could be added.
4. **What happens to season XP during the off-season gap?** If there's a 1-week gap between seasons, XP still accumulates toward total/level but doesn't progress any season track. Daily quests continue but with slightly reduced rewards (no season bonus).
