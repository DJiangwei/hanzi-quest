# Anti-Avoidance Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Spec: `docs/superpowers/specs/2026-07-06-anti-avoidance-rebalance-design.md` — it is implementation-precise; this plan is the task ledger.

**Goal:** R1 review card 1/day global · R2 boss courage award + retry keeps progress · R3 practice card at ≥8 distinct scenes/day (cumulative).

## Global constraints
- Migration 0035 = single `ALTER TYPE coin_reason ADD VALUE 'boss_courage'` (generate via `pnpm db:generate`, append-only).
- All grant idempotency stays server-side (`card_grants_log` PK / coin-tx refId check). No client-derived eligibility.
- Update (don't delete) the PR #87 rebalance tests that assert the old refIds; full suite green + build at PR open.

### Task 1 — R1 review refId `[x when done]`
`src/lib/actions/play.ts` `finishLevelAction`: review refId `${parsed.weekId}:${todayUtcIso()}` → `todayUtcIso()`; drop the practice branch from the same block (R3 moves it; keep `pullSectionCard` for review/boss). Update comment. Tests: rebalance test file(s) asserting refIds.

### Task 2 — R2a courage award
- Migration 0035 (`boss_courage` in `coin_reason` pgEnum, `src/db/schema/economy.ts`) + `AwardCoinReason` in `src/lib/db/coins.ts`.
- `awardBossCourageIfDue(childId, dayUtc)` in `coins.ts`: SELECT existing tx `reason='boss_courage' AND ref_id=dayUtc AND child_id=…`; if none → `awardCoins({delta: 30, reason: 'boss_courage', refType: 'day', refId: dayUtc})`, return `{awarded, delta}`.
- New action `claimBossCourageAction(childId)` in `src/lib/actions/play.ts` (requireChild → awardBossCourageIfDue(todayUtcIso()) → guarded `safeAwardXp(10, 'boss_courage', dayUtc)` when awarded → return `{awarded, delta}`).
- `BossScene`: optional `onDefeated?: () => void`, fired when entering the `defeated` phase (in the lives-0 branch of `handleAnswer`, once). `SceneRunner`: pass handler → call action fire-and-forget → on `awarded` push `EconomyBonus { reason: 'boss_courage', delta, labelZh: '勇敢挑战奖!虽败犹荣', labelEn: 'Brave try — bonus!' }` into `activeBonuses` (check EconomyBonus.reason type — widen union if needed).

### Task 3 — R2b retry keeps progress
`BossScene.reset()`: keep `currentIdx`, restore `lives=3`, phase `intro`. Update/extend `boss-scene-phases`/`boss-scene` tests: lose → retry → next unanswered question shown.

### Task 4 — R3 practice threshold
- `PRACTICE_CARD_DAILY_THRESHOLD = 8` (`src/lib/scenes/configs.ts` next to `BOSS_UNLOCK_PRACTICE_THRESHOLD`).
- `countPracticeClearedToday(childId, weekId, dayUtcIso)` in `src/lib/db/play.ts`: COUNT(DISTINCT week_level_id) over `scene_attempts` JOIN `play_sessions` (childId) JOIN `week_levels` (weekId, `level_key LIKE 'practice:%'`) WHERE `score = 100 AND completed_at >= dayUtc 00:00Z`.
- `finishAttemptAction`: after primary writes, if `parsed.source === 'practice'` (section threaded already) AND this attempt scored 100 → count; if `>= 8` → `pullCardForChild(child.id, 'practice', \`${parsed.weekId}:${dayUtc}\`)`; map granted → `RevealCard`; return new field `cardGrants: RevealCard[]` (default []). Guarded try/catch (a grant failure must not fail the attempt).
- `SceneRunner.advance`: append `result.cardGrants` to the `revealCards` queue (mid-scene branch already renders `CardChestReveal`).

### Task 5 — Gates, docs, PR
Full 4 gates; CLAUDE.md snapshot + section-card landmine rewrite (new mechanics table from spec); roadmap note under a new item; PR + auto-merge on green; post-merge: watch `/admin/economy` bySource over 2 weeks.
