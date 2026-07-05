# Admin Economy Dashboard — Design

**Date:** 2026-07-05 · **Status:** approved by David · **Roadmap ref:** `docs/IMPROVEMENT-ROADMAP.md` §P2-F / F1

## 1. Problem

The economy spans 6+ interlocking systems (coins, XP, shards, 14 card packs, powerups, trophies, season, quests) grown feature-by-feature; nobody can see it holistically. Tuning decisions (is there coin inflation? is the shop nearly bought out? do card grants saturate the daily cap?) are currently vibes. All the data already exists in append-only ledgers.

## 2. Goal

A **read-only** `/admin/economy` page that answers, per child: where do coins come from and go, is the balance inflating, how fast do cards arrive vs. the 10/day cap, how complete is each pack, and how exhausted is the shop. Zero migration, zero writes, zero new deps.

## 3. Architecture

- **Route:** `src/app/admin/economy/page.tsx` (server component). Inherits `assertAdmin` from `src/app/admin/layout.tsx`. Child selection via the existing `?child=` param + `AdminChildPicker`. A small tab strip (控制台 / Console · 经济 / Economy) added to both admin pages for navigation.
- **Queries:** new server-only module `src/lib/db/economy-stats.ts` — pure aggregation reads returning plain data:
  - `coinStats(childId)` → `{ balance, lifetime: { earned, spent, byReason: {reason, total}[] }, last30: same, weeklyNet: { weekStartIso, net }[] }` (8 ISO weeks) — from `coin_transactions` + `coin_balances`.
  - `xpBySource(childId)` → `{ lifetime: {source, total}[], last30: {source, total}[] }` — from `xp_events`.
  - `cardStats(childId)` → `{ daily: { dayUtc, count }[] (last 14 days incl. zero days), bySource: {source, count}[], packCompletion: {slug, nameZh, nameEn, owned, total}[], shards }` — from `child_card_grants_daily`, `card_grants_log`, `child_collections`+`collectible_items`+`collection_packs`, `child_shards`.
  - `shopExhaustion(childId)` → `{ byKind: {kind, owned, total, remainingCost}[], totalRemainingCost, balance }` — from `shop_items` (active) vs `shop_purchases`; avatar ownership counts via `shop_purchases` like other kinds (the generic path).
  - `allChildrenTotals()` → `{ childId, displayName, balance, coins30d, cards14d }[]` for the outlier strip.
- **UI:** `src/components/admin/EconomyDashboard.tsx` (presentational, receives plain data) + tiny primitives `StatBar` (label / value / CSS percentage bar, green/red variant) and `PanelCard`. Pure CSS bars — no chart lib. Everything server-rendered.

## 4. Panels

1. **All-children strip** — one row per child: balance, 30d net coins, 14d cards. Click → selects that child.
2. **金币 Coin flow** — balance headline; lifetime + last-30d: earned / spent / net; per-reason horizontal bars (earn green, spend red, sorted desc); 8-week net-flow bar strip (inflation signal).
3. **XP** — lifetime + 30d totals per source, bar list.
4. **卡片 Cards** — 14-day daily-count bars with the `DAILY_CARD_CAP` (10) line; grant-source breakdown; per-pack completion table (owned/total/%); shard wallet.
5. **商店 Shop exhaustion** — per kind owned/total/% + coin cost of remaining unowned items; headline: total remaining cost vs. current balance ("time-to-buyout" signal that decides F2 urgency).

## 5. Constraints & notes

- Read-only: the module performs SELECTs only; no revalidate, no actions.
- Admin-facing → bilingual kid-chrome rule exempt (keep the console's ZH/EN label style).
- Reward-only packs (gacha_eligible=false) ARE shown in pack completion (they're part of the collection) but the card-source breakdown naturally reflects their non-gacha sources.
- Surfaces (wallpaper/floor) sell as `kind='home'` shop items — they count within `home` exhaustion (matches the generic ownership path).
- Zero-data children must render cleanly (all-zero panels, no division by zero).
- Tests: unit tests for `economy-stats.ts` shaping (db-chain mocks, per house pattern) + one render test of `EconomyDashboard` with fixture data (~10 tests).

## 6. Out of scope (YAGNI)

Custom date ranges, CSV export, cross-child charts, auto-refresh, answer-events analytics (A3's job), any write path.
