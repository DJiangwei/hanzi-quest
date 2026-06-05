# Card Economy v2 — Design Spec

**Date:** 2026-06-04
**Status:** approved (design)
**Context:** hanzi-quest has shipped PRs #1–#60. The card/gacha system (PR #52) works but has three problems surfaced in David's playtests:
1. The shard **swap** feature is invisible — only reachable by tapping a grayed-out locked card, so nobody discovers it (小板 has **14 unused shards**).
2. The card cap is **10/week**, which 小板 maxed out — it feels stingy and resets too slowly.
3. There's **no daily-habit reward** — the gap David flagged ("Yinuo needs prompting to open the app").

This PR addresses all three as one coherent bundle. **Zero change to the coin economy, trophies, or the weighted-pick algorithm.**

---

## 1. North Star

> Cards flow more freely day-to-day (generous daily cap), duplicates visibly convert into chosen missing cards (swap surfaced), and checking in across the week earns a guaranteed variety-pack (一个种类各一张) — giving a concrete "open the app most days" goal.

---

## 2. The three changes

| # | Change | Surface | DB |
|---|---|---|---|
| A | Swap discoverability | `PackPageBody.tsx` (client) | none |
| B | Daily cap replaces weekly cap | `grants.ts`, `play.ts`, callers | migration (new table) |
| C | Weekly check-in 大礼包 | `play.ts`, new grant fn, reveal UI | reuses `card_grants_log` |

---

## 3. Change A — Swap discoverability (client-only)

**Today:** `PackPageBody` makes each *unowned* card an invisible tap target that opens `SwapDialog`. No label, no hint, no visible state. The `SwapDialog` + `swapShardsForItem` action work correctly underneath.

**Change:** surface the affordance without touching the underlying action.

- **Header hint** below the pack title: a one-liner — `用 🔹 碎片换卡片 / Trade shards for any card` — only shown when the pack has ≥1 unowned item.
- **Per-card trade chip:** on each *unowned* card, render a small chip:
  - `shards ≥ SHARD_SWAP_COST (3)` → **`🔹换卡 / Trade`** (enabled, accent color). Tapping opens the existing `SwapDialog`.
  - `shards < 3` → greyed chip reading `需 3🔹` (disabled; tapping it does nothing, but the card itself is non-interactive too).
- Keep the existing dupe `×N` badge on owned cards and the `ShardPill` in the header.
- The whole-card tap-to-swap target is **removed** in favor of the explicit chip (cleaner; the chip is the single affordance).

**No DB, no migration, no action change.** Pure rendering + an extra `shardCount`-driven branch (the data is already passed into `PackPageBody`).

**Tests:** chip renders enabled when `shardCount ≥ 3` and disabled below; tapping enabled chip opens dialog; owned cards show no chip.

---

## 4. Change B — Daily cap replaces weekly cap (migration)

**Today:** `pullCardInTx` reads/writes `child_card_grants_weekly(childId, weekStartUtc, count)` and blocks at `WEEKLY_CARD_CAP = 10`.

**Change:** switch the cap to a **per-UTC-day** counter.

- **New table** `child_card_grants_daily`:
  ```
  child_card_grants_daily(
    child_id  uuid  not null  references child_profiles(id) on delete cascade,
    day_utc   text  not null,            -- ISO YYYY-MM-DD (UTC)
    count     integer not null default 0,
    primary key (child_id, day_utc)
  )
  ```
  Mirrors the existing weekly table exactly, keyed by day.
- **New constant** `DAILY_CARD_CAP = 10` in `grants.ts`. `WEEKLY_CARD_CAP` is kept (dead) for backwards-compat but no longer consulted.
- `pullCardInTx` signature: replace the `weekStartUtc: string` param with `dayUtc: string`. The `FOR UPDATE` select, cap check, and counter upsert all target `child_card_grants_daily`. Return field `cardsThisWeek` → renamed `cardsToday` (update `CardGrantResult` / `CardGrantSkipped` + all consumers).
- **Callers** (`pullCardForChild` and whatever computes `weekStartUtc`): compute `dayUtc = todayUtcIso()` instead. Boss-clear / perfect_week / story-read paths are otherwise unchanged.
- `child_card_grants_weekly` table stays in the DB (append-only rule); it simply stops being written/read. Note this as a landmine.

**Effect:** up to 10 cards/day from gameplay. With only 3 gameplay sources today (boss + perfect_week + story = max 3/day in practice), 10 is effectively "no daily friction" — intentional per David.

**Tests:** cap blocks at the 11th grant in a day; counter is per-day (a grant on day N+1 is not blocked by day N's count); idempotency log still dedupes same `(child, source, refId)`.

---

## 5. Change C — Weekly check-in 大礼包 (gift pack)

**Goal:** reward checking in across the week with a guaranteed **one card per category**.

### 5.1 Trigger

- **Where:** `finishAttemptAction` in `play.ts`, inside the existing `if (tick.ticked)` block, immediately after `awardDailyLoginIfDue(...)` reports `daily.awarded === true` (i.e. this is the *first play of a fresh UTC day* — a new check-in).
- **Condition:** count **distinct check-in days in the current UTC week**. A check-in day = a UTC date with a `daily_login` row in `coin_transactions`. Week boundary = **UTC-Monday** (same `weekStartUtc` shape as the weekly table — reuse the existing helper that computes it).
- When the distinct count is **≥ 5** (the 5-of-7 threshold) **and the week's prize hasn't been granted yet** → grant the 大礼包. (Using `≥` not `== 5` so a child already past 5 when this ships mid-week — or who somehow skips the exact-5 tick — still gets it; the idempotency guard keeps it once-per-week.)
- Granted **at most once per UTC week**, idempotent via `card_grants_log(childId, 'weekly_checkin', weekStartUtc)` (PK collision = already granted, same 23505 pattern as `pullCardInTx`).

### 5.2 The gift pack contents — one card per active pack

- New tx helper `grantGiftPackInTx(tx, childId)`:
  1. Acquire the weekly idempotency guard: `INSERT card_grants_log(childId, 'weekly_checkin', weekStartUtc)`; on 23505 → return `{ granted: false, reason: 'already_granted' }`.
  2. Load all **active** `collection_packs`. **For each pack**, pick **one** card from that pack's catalog using the same ownership-biased logic as `weightedRandomPick` but scoped to the single pack (prefer unowned; if the pack is fully owned, the pick is a dupe).
  3. For each picked card: upsert `child_collections` (new → insert count 1; dupe → count++ **and** +1 shard for that pack) — identical to `pullCardInTx` steps 4–5.
  4. **Bypasses the daily cap entirely:** `grantGiftPackInTx` does NOT read or increment `child_card_grants_daily`. The 大礼包 is "on top."
  5. Returns the list of granted cards (`{ packSlug, itemId, isDupe, shardsAfter }[]`) for the reveal UI.
- Active packs today = 5 (zodiac, flags, sea creatures, dinosaurs, solar system) → **5 cards**. The count is **derived from active packs**, not hardcoded — a future 6th pack auto-joins the 大礼包.
- An empty active-pack catalog (shouldn't happen) is skipped, not fatal.

### 5.3 Surfacing

- **GiftPackReveal** component (new, client): a celebratory modal that flips through the N granted cards (one per category), showing each card + a "🎁 大礼包 / Weekly Gift" banner, and a "+1 🔹" note for any that were dupes. Reuses existing card-rendering primitives where possible.
- **Wiring:** `finishAttemptAction` returns the gift-pack result in its existing bonus/return payload; `SceneRunner` shows `GiftPackReveal` after the level-fanfare layer (same pattern as `LevelFanfare` / `BonusToast`).
- **Home check-in strip:** add a small progress hint — `🎁 本周签到 N/5` — so the goal is visible. When already claimed this week, show `🎁 已领取 / Claimed`. Driven by the same distinct-check-in-days count (server-computed, passed as a prop — no `Date.now()` in render per the existing react-hooks/purity landmine).

### 5.4 Constants

- `WEEKLY_CHECKIN_THRESHOLD = 5`
- `WEEKLY_GIFT_SOURCE = 'weekly_checkin'`
- Gift size is implicit (= active pack count), not a constant.

**Tests:** prize fires when distinct check-in days reaches ≥5 (fires on the 5th day, not the 4th; also fires for a child who joins the week already at 6); idempotent (no double-grant in the same week; the 6th/7th check-in day does not re-grant); grants exactly one card per active pack; dupe picks add a shard; bypasses a maxed daily cap; the `finishAttemptAction` payload carries the reveal data.

---

## 6. Out of scope (explicit)

- Season pass / XP system (the bigger retention layer — deferred; this is the small habit nudge).
- Changing coin rewards, trophy logic, or the per-pack `dropWeight` values.
- Changing the swap **mechanic** (stays shard-based; only its visibility changes).
- Migrating or deleting `child_card_grants_weekly` (kept dead per append-only).
- Animated/per-pack reveal theming beyond the single shared `GiftPackReveal`.

---

## 7. Files touched (estimate)

**New**
- `drizzle/00XX_*.sql` + snapshot — `child_card_grants_daily` table
- `src/db/schema/gacha.ts` — add `childCardGrantsDaily`
- `src/components/play/GiftPackReveal.tsx`
- tests for swap-chip, daily-cap, gift-pack grant, trigger, reveal

**Modified**
- `src/lib/db/grants.ts` — `DAILY_CARD_CAP`, `pullCardInTx` (daily counter), `grantGiftPackInTx`, constants
- `src/lib/actions/gacha.ts` (or wherever `pullCardForChild` lives) — pass `dayUtc`; export a `claimWeeklyGiftIfDue`-style helper
- `src/lib/actions/play.ts` — weekly-prize trigger after daily-login
- `src/components/play/PackPageBody.tsx` — visible trade chip + header hint
- `src/components/scenes/SceneRunner.tsx` — mount `GiftPackReveal`
- home check-in strip component — `N/5` progress hint
- `src/lib/db/activity.ts` or a new helper — distinct-check-in-days-this-week count
- `CLAUDE.md` — record PR + landmines (weekly table dead; daily cap; gift-pack-bypasses-cap)

---

## 8. Done criteria

- Swap chip visible on unowned cards; 小板 can spend her 14 shards from the pack page without tapping a grey card.
- A 4th-then-5th check-in day in a week triggers exactly one 大礼包 of one-card-per-pack; replays/extra days don't re-grant.
- Daily cap blocks at 10/day, resets at UTC midnight; gift pack lands even when the day is capped.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
