# V1 — Mastery model + 航海日志 Logbook

**Status:** design approved 2026-09-04 · roadmap item **V1**
**Depends on:** A1 `answer_events` (PR #132), A2 温故 (PR #165)

---

## 1. Why now, and what the data actually says

The roadmap paced V1 as "cheap once A1 data accumulates (~4–6 weeks of play)".
Two months have passed, so the calendar condition is met. The data condition is
not, and the design is shaped around that gap rather than pretending it closed.

Production `answer_events`, 2026-07-05 → 2026-09-01, read before designing:

| fact | value |
|---|---|
| total rows | 489 |
| children with events | 2 (479 / 10) |
| `correct = true` | 292 |
| `correct = false` | 33 |
| `correct IS NULL` | **164** — every one a 回顾 flashcard self-assessment |
| accuracy on scored answers | **90 %** (292 / 325) |
| distinct characters touched | 96 of 96 in the corpus |
| scored answers per character | 1–2 for 57 chars · 3–4 for 21 · 5–9 for 18 · none above 9 |

Play is bursty, not daily: 151 events on one day, 114 on another, then multi-week
gaps. This is a child who plays in occasional long sessions.

### 1.1 Two findings that changed the design

**The self-assessment signal is degenerate.** All 164 self-ratings are `got_it`.
Not one `not_sure`, not one `dont_know`, ever. A field whose every observation is
the same value carries no information. Whether she truly knows every card or
认识 is simply the fastest way past it, mastery cannot be judged on it — so this
design counts self-ratings as **exposure and recency, never as proof**.

**温故's ranking is diluted by those same rows, and this is a live defect.**
`reviewScore` computes `missRate = (wrong + dontKnow) / total` where
`total = count(*)`, which includes flashcard rows that can never be `correct =
false`. A character with five `got_it` flashcards and one failed practice answer
scores 1/6 ≈ 17 % (weakness 10) when its scored miss rate is 100 % (weakness 60).
On a 0–90 scale that is a 50-point misranking, and it systematically flatters
exactly the characters she has drilled most — the opposite of what a review loop
is for.

Fixing it is in scope (§4). 温故 has **zero plays** in production (0
`daily_review` rows), so no child has yet experienced the current ranking and
changing it costs nothing. Building a mastery surface on top of the distortion
and fixing it afterwards would be the worse order.

---

## 2. What we are building

Two things, sharing one substrate:

1. **`masteryForChar`** — a pure function over one character's telemetry,
   returning a coarse, honest state. No stored column.
2. **航海日志 Logbook** — a kid-facing page where every 字 she has been taught is
   an owned entry, badged only where the evidence supports it.

`reviewScore` is rewritten to consume the same function, so the project has one
ranking truth instead of two that drift.

### 2.1 Decisions locked with David

| Decision | Choice | Why |
|---|---|---|
| Logbook's purpose | **Collection first**, mastery quiet | 字 as collectibles points her collection instinct at the actual learning content. Nothing renders as failure. |
| Unbadged characters | Shown as entries, **no badge** | A character with two observations shows nothing rather than a low rating. A badge she did not earn is a false signal; a *missing* badge is honest and fills in on its own. |
| Scope | **Characters only**, not words | 96 entries, not 522. The game's unit is the 字. |
| Placement | **Hall card in the Backpack** | Not a 7th nav tab. Follows the inlined non-collectible hall pattern. |
| Mastery feedback | **Display-only in v1**, one shared substrate | Nothing changes about what she plays. Kills the drift risk without gameplay risk while data is thin. |
| 温故 dilution | **Fixed inside V1** | Zero plays so far; fixing later means shipping the Logbook on a known distortion. |
| Badge thresholds | **≥3 observations of evidence, ≥80 %** | 31 熟练 / 8 学习中 / 57 unbadged today. |

### 2.2 Non-goals

- **No DB column, no migration.** Computed on read; the corpus is 96 characters
  and hundreds of events. Cache only when measurably slow.
- **No gating, ever.** Mastery unlocks nothing and blocks nothing. It is
  informational, and (later, in V2) a weighting input.
- **No decay in the Logbook.** See §3.3.
- **No words, no stroke data, no per-week drill-down page.**
- **Not a parent surface.** A3 remains separate.

---

## 3. The mastery model

### 3.1 Interface

```ts
// src/lib/mastery/mastery.ts — pure, client-safe, no db imports.

export const MASTERY_MIN_EVIDENCE = 3;
export const PROFICIENT_ACCURACY = 0.8;

export type MasteryState = 'unrated' | 'learning' | 'proficient';

export interface MasteryInput {
  /** Rows with a real right/wrong verdict (`correct IS NOT NULL`). */
  scored: number;
  /** Rows with `correct = false`. A subset of `scored`. */
  wrong: number;
  /** Self-ratings of dont_know / not_sure. NOT a subset of `scored`. */
  dontKnow: number;
}

export interface Mastery {
  state: MasteryState;
  /** (wrong + dontKnow) / evidence, or null when evidence is 0. */
  missRate: number | null;
  /** scored + dontKnow — every observation that COULD express a miss. */
  evidence: number;
}

export function masteryForChar(input: MasteryInput): Mastery;
```

Rules:

- `evidence = scored + dontKnow`.
- `evidence < MASTERY_MIN_EVIDENCE` → `'unrated'`, whatever the accuracy. Two
  correct answers is not mastery.
- otherwise `1 - missRate >= PROFICIENT_ACCURACY` → `'proficient'`, else
  `'learning'`.
- `missRate` is `null` when `evidence === 0`, never `0` — "no evidence" and
  "never missed" must not collapse into the same number.

**Why `evidence` is `scored + dontKnow` and not just `scored`.** `dontKnow` rows
are flashcard self-ratings, so they have `correct IS NULL` and are *not* inside
`scored`. Dividing `(wrong + dontKnow)` by `scored` alone would mix populations
and can exceed 1 — three scored answers and five `dont_know` ratings would yield
a miss rate of 1.67 and a weakness of 100 on a scale meant to top out at 60.
Adding `dontKnow` to the denominator keeps the ratio well-formed while still
excluding the one degenerate value, `got_it`. With today's data `dontKnow` is 0
everywhere, so `evidence === scored` in practice.

### 3.2 Why the denominator excludes `got_it`

This is the whole point of §1.1. Today's denominator is `count(*)`, so `got_it`
self-ratings inflate it without being able to contribute a miss, and a
heavily-flashcarded character looks strong no matter how it actually performs.
`got_it` is the single value dropped. `dontKnow` stays in *both* the numerator
and the denominator, because a self-declared "I don't know this" is real evidence
of not knowing — it simply never occurs in today's data.

Consequence to accept knowingly: a character met only through flashcards she
tapped `认识` on has `evidence === 0` and stays `'unrated'` until she meets it in
practice or a boss. That is correct — a card she tapped through is not proof of
anything. A character she rated `不认识` three times *does* get rated, as
`'learning'`, which is also correct: that is her telling us something.

### 3.3 Why mastery never decays

The Logbook answers *what do you know*; 温故 answers *what should we practise*.
Only the second needs forgetting, and it already models it — `reviewScore`'s
staleness term. Putting decay in the Logbook too would mean a badge she earned
disappears after a fortnight's gap, and her play is bursty by nature. Taking a
reward back for not playing is a punishment mechanic, and this product spends
real effort in the opposite direction (`boss_courage` pays on a failed boss,
retries keep progress, T3 names rewards before the fight).

---

## 4. Rewriting `reviewScore` on the shared substrate

Today (`src/lib/review/selection.ts`):

```ts
const weakness = c.total > 0
  ? Math.round((60 * (c.wrong + c.dontKnow)) / c.total)
  : NEUTRAL_WEAKNESS;
const staleness = Math.min(c.daysSinceLastSeen ?? STALE_DEFAULT_DAYS, STALE_CAP);
return weakness + staleness;
```

After:

```ts
const m = masteryForChar(c);
const weakness = m.missRate === null
  ? NEUTRAL_WEAKNESS
  : Math.round(60 * m.missRate);
const staleness = Math.min(c.daysSinceLastSeen ?? STALE_DEFAULT_DAYS, STALE_CAP);
return weakness + staleness;
```

`ReviewCandidate.total` becomes `ReviewCandidate.scored`, and the DB read's stats
query changes `count(*)` to `count(*) filter (where correct is not null)`.

**This deliberately changes 温故's output.** It is a behaviour fix, not a
refactor, and the plan must not pin the old values. What the tests must pin
instead:

- the specific dilution case — five `got_it` flashcards plus one failed scored
  answer ranks *above* a character with five clean scored answers, and did not
  before;
- `NEUTRAL_WEAKNESS` still applies at `missRate === null`, which is now a
  **larger** population — any character met only through `got_it` flashcards;
- 温故 still returns `REVIEW_SESSION_SIZE` questions for a child with enough
  cleared material.

Watch the second point in review: widening the zero-evidence population shifts
more characters onto the neutral score of 20, which compresses the ranking. With
today's corpus every character has ≥1 scored answer, so the live effect is nil —
but the plan should state the reasoning rather than discover it.

---

## 5. The Logbook surface

### 5.1 Route and entry

- Page: `src/app/play/[childId]/collection/logbook/page.tsx`, a server component.
- Entry: a hall card inlined into `AtlasHub`, above the pack halls, with
  hardcoded bilingual props — **not** routed through `PACK_REGISTRY`. The
  Logbook is 1:1 with the curriculum, has no rarity, no dupes and no shard
  economy; forcing it through pack semantics buys nothing. This is the pattern
  the retired Story Library hall card established.
- `AtlasHub` and `AtlasHallCard` are server components today. The Logbook card
  and page stay server components, so no function-bearing prop crosses an RSC
  boundary. If anyone later marks these `'use client'`, the existing
  `meta: PackUiMeta` prop breaks at request time and local tests will not catch
  it.

### 5.2 Which characters appear

Characters taught in weeks **unlocked** for that child in her current curriculum
pack, via the existing `getWeekGateState` (`src/lib/db/weeks.ts`) — the game's
own notion of what she has access to. Locked future weeks would spoil content and
inflate the denominator with characters she has never met.

Note this is deliberately **wider than 温故's pool**, which requires
`bossCleared`. The Logbook shows what she is *learning*, including the week in
progress; 温故 reviews only what she has *finished*.

### 5.3 What it renders

**Header** — `航海日志 / Captain's Logbook`, her own counts: total entries and
熟练 count. Self-referential progress, never a comparison with another child
(standing rule; `tests/unit/gift-inbox.test.tsx` guards the sibling case).

**Grid** — one tile per character: the 字 large, pinyin beneath, and a small badge
only when `state !== 'unrated'`. No colour codes failure: 学习中 and unbadged are
visually quiet, 熟练 is the only decorated state.

**Detail** — tapping a tile opens meaning, first word, example sentence and a
`SpeakButton`, reusing the flashcard content already threaded through
`getCharactersWithDetailsForWeek`.

**Empty state** — a child with no unlocked weeks sees a warm placeholder, never
"0 characters learned".

### 5.4 Copy

Bilingual, 中文 first, per the standing rule. Badges: `熟练 / Solid`,
`学习中 / Learning`. Nothing anywhere reads as a score, a test result, or a
comparison — the same constraint 温故's entry card carries.

---

## 6. Data access

New read `getLogbookEntries(childId)` in `src/lib/db/logbook.ts`, server-only and
deliberately **not** under `src/lib/actions/` (every exported async function in a
`'use server'` file is a public RPC endpoint, and this one takes a raw
`childId`).

Returns per character: `characterId`, `hanzi`, `pinyin`, `meaningEn`,
`weekNumber`, plus `scored` / `wrong` / `dontKnow` for `masteryForChar`.

Shape it on `src/lib/db/review.ts`, which solves the same problem: characters
from a set of weeks, left-joined by construction against an `answer_events`
aggregate so characters with no telemetry survive rather than being dropped by a
join. Reuse the `filter (where ...)` aggregate idiom already there.

---

## 7. Testing

- **`masteryForChar`** — the threshold boundaries (2 vs 3 evidence; 79 % vs 80 %), that `evidence` counts `scored + dontKnow` so `missRate` can never exceed 1,
  `missRate === null` at zero evidence, and `dontKnow` counting as a miss while
  `got_it` rows never reach the function at all.
- **`reviewScore`** — the dilution case from §4, proven by running it against the
  pre-fix formula and watching the ranking invert.
- **Logbook page** — renders every unlocked character; badges only above
  threshold; no badge for a 2-observation character; empty state; bilingual
  chrome.
- **Guard test** — no rank, no comparison, no failure framing, mirroring
  `tests/unit/gift-inbox.test.tsx`.
- Every guard proven load-bearing by breaking it and watching a test fail —
  **and where a fixture uses a seeded shuffle, the seed is chosen against the
  broken code**, per the landmine added in PR #166.

---

## 8. Post-merge

No migration, no recompile, no seed script, no Blob operations. `answer_events`
is read-only here.

---

## 9. Follow-ups this design deliberately leaves open

1. **The degenerate self-rating.** 164/164 `got_it` means 认识 is almost
   certainly the path of least resistance in `FlashcardScene`, not a true
   report. Worth a UX look — button order, or requiring a beat before advancing.
   Out of scope, but it is the reason §3.2 exists and it will keep costing signal
   until someone looks.
2. **V2 smart distractors** can now weight on `masteryForChar` rather than
   inventing a third scorer.
3. **A3 parent insights** should read the same function, so parent and child
   never see contradictory pictures of the same character.
