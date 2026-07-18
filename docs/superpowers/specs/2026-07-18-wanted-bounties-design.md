# 通缉令 Wanted-character bounties (T2) — design

Date: 2026-07-18 · Approved by David ("T1+T2 都要", started on his "T2 通缉令开工吧")

## Problem

Round 3 of anti-avoidance. T1 (frontier 2×) steers her toward the next
un-bossed WEEK; T2 steers her toward specific CHARACTERS she's weak on or has
never practiced (telemetry: weeks 7/9 untouched, weak chars invisible). This
is also the first consumer of the A1 `answer_events` data — the seed of the
A2 review engine.

## Mechanic

Three daily **wanted posters** (通缉令) on the play home page, pirate-parchment
style. Each poster names one character with a bounty. Answering questions on
that character correctly ANYWHERE (review/practice/boss/study/homework —
wherever answer events flow) ticks the poster; at `BOUNTY_REQUIRED_HITS` (2)
correct answers the poster is claimable: tap → +40🪙 +10XP. Claiming all 3 in
one day grants a **bounty card** (`pullCardForChild('bounty', dayUtc)` —
consumes the daily cap; effort-funded like practice/review cards).

## Selection engine (`src/lib/bounty/ranking.ts`, pure)

Candidates = all characters of the child's published weeks in the current
pack. Per-char stats from `answer_events` (all-time): `total`, `wrong`
(correct=false), `dontKnow` (self_rating='dont_know'/'not_sure'). Score:

- **unseen** (total=0): `100 + weekNumber` — never-practiced chars first,
  later weeks outrank earlier (targets the avoidance directly).
- **weak**: `round(60 * (wrong + dontKnow) / total) + weekNumber`, only when
  `wrong + dontKnow > 0`.
- everything else: score 0 (never posted).

Top 3 by (score desc, weekNumber desc, hanzi asc). Chars with a bounty in the
last `BOUNTY_COOLDOWN_DAYS` (3) days are excluded (no repeat wallpapering).
Fewer than 3 eligible → generate fewer (0 posters → panel hidden).

## Storage (migration 0038)

`bounty_posters (id, child_id, day_utc, character_id, required, progress,
claimed_at, created_at)`, UNIQUE `(child_id, day_utc, character_id)`.
Generated idempotently on home render (`generateDailyBounties`, quests
pattern: rows exist for today → no-op). Progress is a stored counter ticked
server-side; claim stamps `claimed_at` (idempotent claim guard).

## Progress ticking

All answer events flow through `finishAttemptAction.events` (single site).
After `logAnswerEventsSafe`, a guarded `tickBountyProgressSafe(childId,
characterIds)` bumps `progress = LEAST(progress+1, required)` on today's
unclaimed posters for each correct event's characterId. Fire-and-forget
semantics: failure never breaks the attempt.

## Claim (`claimBountyAction`)

Auth-gated. In tx: re-read poster; `progress >= required && claimed_at IS
NULL` → stamp claimed_at, award +40🪙 (`bounty_claim` coin reason, migration
0038) +10XP. Then if all of today's posters are claimed → `pullCardForChild
('bounty', dayUtc)` (idempotent via grants log; may return `daily_cap_reached`
— coins still paid). Returns a discriminated outcome + optional RevealCard
surfaced via `CardChestReveal` in the panel.

## UI (`WantedPosters.tsx`)

Panel under the quests: up to 3 parchment poster cards — "通缉 WANTED" header,
the hanzi BIG (no pinyin/meaning — that's the quarry), progress pips (●○),
reward line (🪙40), and a claim button when complete. Poster deep-links to the
char's week hub (steering). Bilingual chrome; reduced-motion safe (no new
animation beyond existing patterns).

## Non-goals

No SRS scheduling, no difficulty scaling, no parent surface (A3 will read the
same data), no bounty for words (chars only, v1).

## Tests

Ranking (unseen-first + later-week priority, weak scoring, cooldown, <3
candidates); generation idempotency; tick caps at required + skips claimed;
claim outcomes (success / not-ready / double-claim) + all-3 card; panel
render/claim/reveal; play.ts tick gating (correct-only, guarded failure).
