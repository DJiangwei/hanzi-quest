# 温故 Daily mixed review (A2) — design

> Roadmap item **A2** (`docs/IMPROVEMENT-ROADMAP.md`, P0-A "Learning intelligence"), rank 4.
> Second consumer of the A1 `answer_events` telemetry after T2 bounties.
> Scope decided with David 2026-08-25: **slice 2 only** (the 温故 session). Slice 1
> (cross-week distractors in ordinary practice) is deferred to its own PR — see Non-goals.

---

## Problem

The game has no cross-week retention loop. A character is drilled hard during its
own week and then, unless it happens to reappear in a boss gauntlet, never again.
Practice distractors are drawn from the same week's pool, so even re-exposure stays
inside the week that taught it. Telemetry has been accumulating since 2026-07-03
(PR #132) and nothing reads it back into what the child actually plays.

GAME-DESIGN.md §9's "no SRS" non-goal was written in Oct 2025 and conditioned on
"no play data yet". That condition no longer holds. Full SM-2 SRS remains out of
scope; this is the naive alternative §9 itself blesses.

---

## Mechanic

A short, optional, once-a-day mixed-review session drawn from characters in weeks
the child has already cleared.

- **6 questions**, mixed types, built at runtime (no `week_levels` rows, no compile).
- **Gates nothing.** Boss unlock still counts practice only. Nothing anywhere
  requires 温故 to have been played.
- **Replayable** for practice; pays **once per UTC day**.
- Reward: coins + **one card** through the shared 10/day cap.
- Entry: a home card below the 通缉令 posters. Hidden entirely when the child has
  fewer than `REVIEW_SESSION_SIZE` candidates (a brand-new kid, or nobody with a
  cleared week).

---

## Selection engine (`src/lib/review/selection.ts`, pure)

Client-safe, no db imports — same shape as `src/lib/bounty/ranking.ts`.

```ts
export interface ReviewCandidate {
  characterId: string;
  hanzi: string;
  weekNumber: number;
  total: number;              // all-time answer_events rows targeting this char
  wrong: number;              // correct = false
  dontKnow: number;           // dont_know / not_sure self-ratings
  daysSinceLastSeen: number | null;  // null = no telemetry at all
}
```

```
weakness  = total > 0 ? round(60 * (wrong + dontKnow) / total) : NEUTRAL_WEAKNESS
staleness = min(daysSinceLastSeen ?? STALE_DEFAULT_DAYS, STALE_CAP)
reviewScore = weakness + staleness
```

Tunables in one place: `NEUTRAL_WEAKNESS = 20`, `STALE_DEFAULT_DAYS = 14`,
`STALE_CAP = 30`, `REVIEW_SESSION_SIZE = 6`.

`pickReviewTargets(candidates, count)` returns the top `count` by score, ties broken
`weekNumber` desc then `hanzi` — deterministic, mirroring `pickBounties`.

### Why NOT reuse `bountyScore`

The roadmap says to reuse `bountyScore` weighting directly. **That is the wrong
scorer for this feature**, and the design deliberately diverges.

`bountyScore` ranks a never-answered character above every weak one
(`total === 0 → 100 + weekNumber`) because bounties exist to push the child into
*unvisited later weeks* — that is the avoidance behaviour T2 targets. Review targets
the opposite population: characters she has already cleared and is now forgetting.

Two concrete failures if it were reused:

1. **Untelemetered characters would dominate.** `answer_events` only started
   2026-07-03. Every character in a week cleared before that date has `total === 0`
   despite being thoroughly learned, and would score 100+, crowding out genuinely
   weak characters indefinitely.
2. **Recency is not modelled at all.** Time since last seen is the core forgetting
   signal for a review loop, and `bountyScore` has no term for it.

Hence `NEUTRAL_WEAKNESS`: an untelemetered character sits mid-range — worth
reviewing, never dominant.

---

## Session construction (`src/lib/review/session.ts`, pure)

Mirrors `buildStudyLesson` (`src/lib/play/study.ts`): pure, injectable `rng`, returns
a runtime question list. No db import, no compile step, no `scene_templates` row.

For each target, pick among the types the character can actually support **against
the cross-week pool**:

| Type | Requires |
|---|---|
| `translate_pick` | target has `meaningEn`; ≥3 pool chars with a different `meaningEn` |
| `audio_pick` | ≥3 other pool chars (device TTS — correct by construction) |
| `image_pick` | a **valid** stimulus word (below); ≥3 other pool chars |

If a target supports no type, drop it and take the next-highest-scoring candidate.

### The PR #158 hazard, handled explicitly

温故's pool is **cross-week by definition**. PR #158's `validStimulusWords`
(`src/lib/scenes/stimulus-validity.ts`) rejects a stimulus word shared with another
character *in the same week*, because that is the pool distractors were drawn from.
Widen the pool across weeks and the same failure returns one week over: the 唱歌
picture with 唱 correct and 歌 offered as a distractor has no correct answer.

`validStimulusWords(hanzi, words, wordOwners)` already takes `wordOwners` as a
parameter, so the fix is to **build that map over the entire review pool** rather
than one week — reuse, not new logic. Counting characters (一…十) continue to bypass
diffusion art entirely for the procedural `CountingBalloons` SVG, and the 💡 hint
stays suppressed for them.

This must have a test that fails when the guard is removed. See Tests.

---

## Data layer (`src/lib/db/review.ts`, server-only)

`getReviewCandidates(childId)`:

1. Cleared weeks = `week_progress.bossCleared = true`, restricted to the child's
   current curriculum pack.
2. Their characters, LEFT JOINed to `answer_events` aggregates grouped by
   `character_id`: `count(*)`, `count(*) filter (correct = false)`,
   `count(*) filter (self_rating in ('dont_know','not_sure'))`, `max(created_at)`.
3. Returns `{ candidates: ReviewCandidate[], pool: CharacterDetail[] }` — the pool is
   shaped exactly as the section page already builds it, so the existing scene
   components take it unchanged.

A LEFT JOIN is required, not an inner join: a character with zero telemetry must
still appear (that is what `NEUTRAL_WEAKNESS` exists for).

---

## Route + runner

- `/play/[childId]/review` — server component: candidates → `pickReviewTargets` →
  `buildReviewSession` → `<ReviewRunner>`.
- `ReviewRunner` (client) mirrors `StudyRunner`: renders the **real scene
  components**, accumulates `SceneAnswerEvent[]` in a ref, calls
  `finishReviewAction` once at the end, surfaces rewards through the existing
  `CardChestReveal`.
- **Mount `<MidSceneFlag />`.** CLAUDE.md landmine: any long-session route must
  mount it or `KidNavBar` tab taps navigate away without the quit-confirm.
- Scene option shuffles keyed on a stable primitive id, per the shuffle landmine.

---

## Action (`src/lib/actions/review.ts`)

`finishReviewAction({ childId, score, events })`:

1. `requireChild(childId)` — every child-scoped server action gates at its entry.
2. `logAnswerEventsSafe(...)` with `source: 'daily_review'` set **server-side** from
   the validated context, never from the client.
3. `pullCardForChild('daily_review', todayUtcIso())` — **cap-consuming**, refId is
   the day alone (once per UTC day globally, like the section-review card).
4. Coins + XP awarded **only on the `granted` branch**, mirroring homework/study: the
   card-grant log row is the single idempotency source, since `awardCoins` itself is
   not idempotent.
5. Guarded quest tick + `revalidatePath`, after the primary writes.

---

## Rewards (concrete)

| | Value | Notes |
|---|---|---|
| Coins | **40** | `coin_reason = 'daily_review'`. Same order as a bounty claim (40), below a boss clear — a warm-up, not a grind target. |
| XP | **15** | `XpSource = 'daily_review'`. |
| Card | **1** | `pullCardForChild('daily_review', dayUtc)`, consumes the shared 10/day cap. |

**Completing pays regardless of score.** `score` is recorded in the answer events and
returned for the summary screen, but no reward branches on it. A review session that
punished wrong answers would be a test, and this product deliberately does not test
her — the same reasoning behind `boss_courage` paying out on a *failed* boss attempt.

**Short-candidate behaviour.** The home entry card is hidden below
`REVIEW_SESSION_SIZE` distinct candidates, so a normal session is always 6 distinct
characters — no cycling, unlike `buildStudyLesson`. `pickReviewTargets` still returns
a short list defensively rather than throwing, so a race between the home render and
the route cannot produce a crash.

---

## Schema changes

**Migration 0042** — one DDL statement:

> Was 0041. The 存钱罐 piggy-bank spec (2026-08-31) claimed 0041 and is
> expected to land first; renumber again if the merge order changes.

```sql
ALTER TYPE coin_reason ADD VALUE 'daily_review';
```

Everything else is a text column and needs **no migration**, only a TS union edit:

- `XpSource` (`src/lib/db/xp.ts`) — add `'daily_review'`
- `pullCardInTx`'s `source` union (`src/lib/db/grants.ts`) — add `'daily_review'`
- `ANSWER_SOURCES` (`src/lib/play/answer-events.ts`) — add `'daily_review'`

### Naming trap

`ANSWER_SOURCES` **already contains `'review'`** — that is the per-week flashcard
*section*, not this feature. The new source must be `'daily_review'`. Reusing
`'review'` would make the two indistinguishable in `answer_events`, corrupting the
exact signal this feature is built on and every future consumer of it (A3 parent
insights, V1 mastery).

---

## Non-goals

- **No SRS.** No intervals, no ease factors, no scheduling state. Scores are computed
  on read from `answer_events`; nothing is stored.
- **No gating.** 温故 never blocks a boss, an island, or a reward path.
- **No streak or "don't break the chain" pressure.** This product exists partly to
  soften 畏难情绪; a review streak would re-add the pressure that `boss_courage` and
  T3's reward-preview were built to remove.
- **No comparative surface.** No rank, no "you reviewed more than…", per the crew
  landmine.
- **Slice 1 (cross-week distractors in ordinary practice) is deferred.** Now known to
  be cheaper than the roadmap assumed — four of five MCQ scene types sample
  distractors at *runtime* from a `pool` prop, so it is mostly a matter of widening
  what the section page passes, with no recompile. But it must re-derive the #158
  ambiguity guarantee across the widened pool, and that deserves its own diff rather
  than riding along with a new surface.
- **No mastery stars / Logbook** (V1). This feature deliberately stores nothing, so
  V1 remains free to define mastery independently.

---

## Tests

Pure engines first, since they carry the real logic:

- `reviewScore`: weakness from error rate; staleness capped at `STALE_CAP`;
  untelemetered characters get `NEUTRAL_WEAKNESS` and do **not** outrank a genuinely
  weak character (the explicit anti-`bountyScore` assertion).
- `pickReviewTargets`: deterministic ordering; tie-breaks; returns fewer than `count`
  when candidates are short.
- `buildReviewSession`: type eligibility per character; a target supporting no type is
  dropped and backfilled; deterministic under an injected `rng`.
- **Cross-week ambiguity guard** — a pool where two characters *from different weeks*
  own the same word must never produce an `image_pick` offering both. Per the #158
  lesson, this test is to be **run against the unguarded builder once and watched to
  fail** before the guard is added.
- Counting characters (一…十) route to `CountingBalloons`, never to diffusion art.
- `finishReviewAction`: reward paid only on the `granted` branch; a second call the
  same UTC day pays nothing; `requireChild` gates entry; events carry
  `source: 'daily_review'`.
- `ReviewRunner`: renders, advances, submits once, surfaces the chest.
- Bilingual chrome on the home entry card and the runner.

Suites importing the action must mock `@/db` plus every `@/lib/db/*` it pulls in, per
the mock-`@/db` landmine.

---

## Post-merge ops

Migration 0042 applies automatically on the Vercel production build
(`tsx scripts/migrate.ts && next build`). **No recompile, no seed script.**
