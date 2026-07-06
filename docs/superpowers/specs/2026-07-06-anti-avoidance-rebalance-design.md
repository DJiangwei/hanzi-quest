# Anti-Avoidance Rebalance (R1+R2+R3) — Design

**Date:** 2026-07-06 · **Status:** approved by David · **Context:** playtest finding — the child logs in daily, farms the zero-risk review card across all 10 published weeks (up to the full 10/day cap), and avoids practice + boss. Root cause is incentive design, not the child: review pays best per minute with zero failure risk; practice requires 15 scenes in ONE sitting; a boss loss costs everything (full restart, no reward).

## R1 — Review card: once per UTC day GLOBAL

`finishLevelAction`'s review grant changes refId from `${weekId}:${dayUtc}` → **`dayUtc` alone** (source `'review'`, `card_grants_log` PK dedupes). Farming 10 old weeks' reviews now yields exactly 1 card. Any repeat review that day reports the existing `'review_done_today'` message (copy still accurate). Old log rows (weekId-prefixed refIds) never collide with the new scheme — worst case she gets one normal card on transition day.

## R2 — Boss: courage award on loss + retry keeps progress

**R2a courage award (server):** the day's FIRST failed boss attempt still pays: **+30 coins + 10 XP** with an encouraging bilingual toast (勇敢挑战奖!虽败犹荣 / Brave try!). New coin reason **`boss_courage`** (migration 0035, `ALTER TYPE coin_reason ADD VALUE` — additive) + `AwardCoinReason` union. Idempotent per (child, UTC day) via `awardBossCourageIfDue(childId, dayUtc)` in `src/lib/db/coins.ts` (checks for an existing `boss_courage` tx with `ref_id = dayUtc`, mirroring `awardDailyLoginIfDue`). Trigger: new server action `claimBossCourageAction(childId)` (`requireChild`; returns `{ awarded, delta }`), called fire-and-forget from `SceneRunner` when `BossScene` reports a defeat via a new optional `onDefeated?: () => void` prop (fired once per entry into the `defeated` phase). Award surfaces through the existing `BonusToast` layer (`EconomyBonus` with reason `boss_courage`). XP via `safeAwardXp(child.id, 10, 'boss_courage', dayUtc)`-style guarded call inside the action (xp source is text — no migration).

**R2b retry keeps progress (client-only):** `BossScene.reset()` restores 3 lives and replays the intro but **no longer resets `currentIdx`** — questions already answered correctly stay answered. Deliberate easing: combined with 3 lives per retry this makes the boss beatable by persistence; the fear being removed is "one loss wipes everything". Telemetry (`boss_question` answer events) still records every wrong answer, so difficulty data survives.

## R3 — Practice card: daily cumulative threshold, not single-sitting completion

Replace the "full 15-scene session" practice grant (refId = sessionId, in `finishLevelAction`) with: **once per (week, day), granted the moment the child's DISTINCT practice scenes cleared today for that week reaches `PRACTICE_CARD_DAILY_THRESHOLD = 8`** (score = 100, counted from `scene_attempts` joined via `play_sessions` for childId and `week_levels.level_key LIKE 'practice:%'`, `completed_at` within the UTC day). She can do 5 scenes, leave, come back — progress counts.

- Grant moves into `finishAttemptAction`: after recording a practice-section attempt, call new `countPracticeClearedToday(childId, weekId, dayUtc)` (`src/lib/db/play.ts`); if `>= 8`, `pullCardForChild('practice', \`${weekId}:${dayUtc}\`)` (once-per-week-per-day via the grants log; still consumes the shared 10/day cap). The card returns on a new `cardGrants: RevealCard[]` field of `finishAttemptAction` and surfaces mid-scene through the existing `CardChestReveal` queue in `SceneRunner` (same path as gift-pack cards).
- `finishLevelAction`'s practice branch is REMOVED (review branch stays, with the R1 refId). Full-session completion still pays coins/XP/fanfare as before — only the card moved.
- Repeat-grind of the same week's practice the same day no longer mints extra cards (previously per-session) — acceptable: the grind path was theoretical, and boss repeats remain the repeatable card source.

## Incentive landscape after this PR

| 行为 | 卡片 | 风险 |
|---|---|---|
| 刷回顾(任意多周) | 1/天 | 零 |
| 练习(当天累计 8 道,任意分段) | 1/周/天 | 零(答错不惩罚) |
| Boss 胜 | 1/次(可重复) | 输了保留进度 + 首败有勇气奖 |

Review stays a pleasant warm-up; practice becomes the reliable daily earner; the boss is the jackpot with a soft landing.

## Testing (~14 tests)
- R1: review refId is `dayUtc`; second review of a DIFFERENT week same day → `review_done_today`, no second card (update the PR #87 rebalance tests that assert per-week refIds).
- R2a: `awardBossCourageIfDue` idempotent per day; action returns awarded/delta; `BossScene` fires `onDefeated` exactly once per defeat phase entry.
- R2b: after 3 wrong answers + retry, `currentIdx` is preserved (lose → retry → the NEXT question renders, not question 1).
- R3: `countPracticeClearedToday` counts distinct practice levels only (repeats/review/boss excluded); `finishAttemptAction` grants at the 8th distinct clear, not the 7th, and not twice; grant respects the daily cap; `finishLevelAction` no longer grants practice cards.

## Ops
Migration 0035 (enum value) auto-applies on deploy. No recompile, no seeds. CLAUDE.md: update the section-card landmine + snapshot. Measure the effect in `/admin/economy` card-source split after ~2 weeks.
