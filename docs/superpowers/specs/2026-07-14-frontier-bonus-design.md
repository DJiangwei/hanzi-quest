# Frontier Double Treasure (T1) — Design

**Date:** 2026-07-14 · **Status:** approved by David ("T1+T2 都要"; this is T1) · **Context:** prod telemetry shows the child replays weeks 1–2 (86/44 answer events) and farms their easy bosses, while weeks 4+ bosses stay unbeaten (the "challenge wall" = week 4's boss) and weeks 7/9 are untouched. Old and new content pay identically; new content carries all the risk. Pure-carrot fix: make the frontier visibly more rewarding.

## Definitions

**Frontier week** (per child, per pack): the published week with the LOWEST `week_number` whose boss the child has NOT cleared (`week_progress.boss_cleared` false or missing). After each boss clear the frontier advances automatically. All bosses cleared → no frontier → no bonus (final boss / next map take over).

## Changes

### 1. Cleared-island semantics fix (prerequisite, honesty)
The voyage board marks an island 🏴 when `completionPercent >= 100` — but 100% is reached by finishing any section, so unbeaten weeks 4–10 show as "done", killing the completion pull. Fix: island `cleared` = **`bossCleared`**. Islands data (`page.tsx`) gains `bossCleared`; `VoyageBoard` uses it for the 🏴/⛵ states (`currentIndex` = first un-bossed island = the frontier, automatically); the home "N/M islands cleared" count follows. `completionPercent` stays in the data shape (unused by the board).

### 2. Economics (server-side, `isFrontierWeek(childId, weekId)` in `src/lib/db/weeks.ts`)
- `finishAttemptAction`: frontier-week scenes pay **×2 coins** (base + perfect bonus; the doubled value is what's recorded on the attempt row + toasted).
- `finishLevelAction`: frontier boss FIRST clear pays **×2 boss coins** (the existing 300, already first-clear-gated) and **+1 extra card** (`pullSectionCard('boss_clear', \`${sessionId}:frontier\`)` — both cards surface in the same chest reveal queue).
- Repeat/old-week rewards unchanged — carrot only, no stick. The 10/day card cap still bounds everything.

### 3. Visibility (the kid must SEE the carrot)
- **Voyage board**: the frontier stop gets a glowing gold badge **`✨2×`** (aria: 双倍宝藏 / Double treasure) next to the existing ⛵ current marker; CSS pulse, reduced-motion static.
- **Week hub**: when the viewed week is the frontier, a banner: **"✨ 双倍宝藏周!金币×2 · Boss 首通双卡 / Double treasure island! 2× coins · 2 cards for first boss clear"**.

### 4. Daily-quest steering
New template `frontier_practice` (🚩 新岛先锋 / Trailblazer, target 3, xp 25): "在最新的海岛做 3 道练习". Ticked in `finishAttemptAction` when `source==='practice' && frontier`. `QuestContext` gains `hasFrontier: boolean` (from islands data on home render) so the quest is only assigned while a frontier exists (an unfinishable quest would block the daily chest).

## Implementation notes
- `isFrontierWeek`: one query — target week's pack + `MIN(week_number)` over published pack weeks not boss-cleared by the child; compare. Called once per finish action (≤2 extra queries per scene).
- Week hub page computes the flag server-side and passes a boolean into the hub component (no client config).
- No migration (no new tables/enums), no recompile.

## Tests (~10)
`isFrontierWeek` comparator logic (pure shaping fn) · attempt coins doubled on frontier only · boss first clear on frontier → 2 cards + doubled coins; repeat clear → normal · quest tick fires only for frontier practice · `frontier_practice` template feasibility via `hasFrontier` · VoyageBoard: cleared uses bossCleared + `✨2×` badge renders on the current stop · hub banner render.

## T2 (separate follow-up PR, already approved)
通缉令 wanted-character bounties from answer_events — designed after T1 ships.
