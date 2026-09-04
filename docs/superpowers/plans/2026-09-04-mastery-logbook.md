# V1 — Mastery model + 航海日志 Logbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every character the child has been taught a visible, owned entry in a 航海日志 Logbook, badged by a single mastery function that also replaces 温故's diluted weakness term.

**Architecture:** One pure function, `masteryForChar`, over per-character `answer_events` counts. Two readers: the Logbook (display) and `reviewScore` (ranking). No stored column, no migration — the corpus is 96 characters and hundreds of events, so mastery is computed on read. The Logbook is a hall card in the Backpack leading to a grid page, following `TrophiesHallCard`'s non-pack precedent.

**Tech Stack:** Next.js 16 App Router (server components by default), Drizzle/Neon, Vitest + React Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-04-mastery-logbook-design.md`

## Global Constraints

- **Bilingual chrome, 中文 first.** Every kid-facing label is `中文 / English` — `bi(zh,en)` from `@/lib/i18n/bilingual` for a single string, or a ZH-span + EN-span pair in JSX.
- **No rank, no streak, no tally across sessions, no comparative figure between children.** The Logbook's counts are self-referential only.
- **Nothing renders as failure.** `学习中` and unbadged are visually quiet; `熟练` is the only decorated state. No red, no ✗, no "needs work", no percentage shown to the child.
- **Mastery gates nothing.** It unlocks nothing and blocks nothing.
- **No migration, no recompile, no seed script, no Blob operations.**
- **`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green at PR open.**
- **Tests mock external boundaries** (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`). A test importing a `@/lib/db/*` module MUST `vi.mock('@/db', () => ({ db: {} }))` or it throws `DATABASE_URL is not set` **on CI only**.
- **Server-only reads never live in `src/lib/actions/`** — every exported async function in a `'use server'` file is a public RPC endpoint, and these take a raw `childId`.
- **Prove every guard load-bearing** by breaking it and watching a test fail. Where a fixture uses a seeded shuffle, choose the seed against the BROKEN code (CLAUDE.md Testing landmine, PR #166).
- Baseline before Task 1: **341 test files / 2084 tests green.**

---

### Task 1: The mastery function

**Files:**
- Create: `src/lib/mastery/mastery.ts`
- Test: `tests/unit/mastery.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MASTERY_MIN_EVIDENCE = 3`, `PROFICIENT_ACCURACY = 0.8`, `type MasteryState = 'unrated' | 'learning' | 'proficient'`, `interface MasteryInput { scored: number; wrong: number; dontKnow: number }`, `interface Mastery { state: MasteryState; missRate: number | null; evidence: number }`, `masteryForChar(input: MasteryInput): Mastery`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/mastery.test.ts`:

```ts
// V1 — the single mastery substrate. Read the spec's §1.1 before changing a
// threshold: 164 of production's 489 answer_events are flashcard self-ratings
// and every one of them is `got_it`, so a denominator that counts them makes
// a heavily-drilled character look strong no matter how it performs.
import { describe, expect, it } from 'vitest';
import {
  MASTERY_MIN_EVIDENCE,
  PROFICIENT_ACCURACY,
  masteryForChar,
} from '@/lib/mastery/mastery';

describe('masteryForChar', () => {
  it('is unrated with no evidence at all, and missRate is null rather than 0', () => {
    // "never missed" and "never observed" must not collapse into one number —
    // reviewScore branches on exactly this to apply NEUTRAL_WEAKNESS.
    const m = masteryForChar({ scored: 0, wrong: 0, dontKnow: 0 });
    expect(m.state).toBe('unrated');
    expect(m.missRate).toBeNull();
    expect(m.evidence).toBe(0);
  });

  it('is unrated just below the evidence threshold, however perfect', () => {
    const m = masteryForChar({ scored: MASTERY_MIN_EVIDENCE - 1, wrong: 0, dontKnow: 0 });
    expect(m.state).toBe('unrated');
    expect(m.missRate).toBe(0);
  });

  it('rates at exactly the evidence threshold', () => {
    const m = masteryForChar({ scored: MASTERY_MIN_EVIDENCE, wrong: 0, dontKnow: 0 });
    expect(m.state).toBe('proficient');
    expect(m.evidence).toBe(MASTERY_MIN_EVIDENCE);
  });

  it('is proficient exactly at the accuracy threshold, not just above it', () => {
    // 5 scored, 1 wrong = 80% — the boundary itself must qualify.
    const m = masteryForChar({ scored: 5, wrong: 1, dontKnow: 0 });
    expect(1 - (m.missRate ?? 1)).toBeCloseTo(PROFICIENT_ACCURACY, 10);
    expect(m.state).toBe('proficient');
  });

  it('is learning just below the accuracy threshold', () => {
    // 5 scored, 2 wrong = 60%.
    expect(masteryForChar({ scored: 5, wrong: 2, dontKnow: 0 }).state).toBe('learning');
  });

  it('counts a dont_know self-rating as a miss', () => {
    const m = masteryForChar({ scored: 3, wrong: 0, dontKnow: 3 });
    expect(m.missRate).toBeCloseTo(0.5, 10);
    expect(m.state).toBe('learning');
  });

  it('keeps missRate <= 1 when dont_know ratings outnumber scored answers', () => {
    // The bug this shape exists to prevent: dontKnow rows have correct IS NULL,
    // so they are NOT inside `scored`. Dividing (wrong + dontKnow) by `scored`
    // alone would give 5/3 = 1.67 here and a weakness of 100 on a 0-60 scale.
    const m = masteryForChar({ scored: 3, wrong: 0, dontKnow: 5 });
    expect(m.evidence).toBe(8);
    expect(m.missRate).toBeLessThanOrEqual(1);
    expect(m.missRate).toBeCloseTo(5 / 8, 10);
  });

  it('rates a character she has only ever declared she does not know', () => {
    // She is telling us something. scored === 0 does not mean no information.
    const m = masteryForChar({ scored: 0, wrong: 0, dontKnow: 3 });
    expect(m.state).toBe('learning');
    expect(m.missRate).toBe(1);
  });

  it('never returns proficient on evidence thinner than the threshold', () => {
    for (let scored = 0; scored < MASTERY_MIN_EVIDENCE; scored++) {
      expect(masteryForChar({ scored, wrong: 0, dontKnow: 0 }).state).not.toBe('proficient');
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run tests/unit/mastery.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/mastery/mastery"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mastery/mastery.ts`:

```ts
// V1 — the single mastery substrate over A1 `answer_events`.
//
// PURE and client-safe: no `@/db`, no `@/lib/db/*`, no React, no randomness.
// Two readers depend on it — the 航海日志 Logbook (display) and
// `reviewScore` (温故's ranking) — so that the project has one notion of "how
// well does she know this character" instead of two that drift.
//
// Deliberately NOT a stored column. The corpus is 96 characters and hundreds
// of events; compute on read and cache only when measurably slow.

/** Observations required before a character earns any badge at all. */
export const MASTERY_MIN_EVIDENCE = 3;

/** Accuracy at or above which a rated character reads as 熟练. */
export const PROFICIENT_ACCURACY = 0.8;

export type MasteryState = 'unrated' | 'learning' | 'proficient';

export interface MasteryInput {
  /** Rows with a real right/wrong verdict (`correct IS NOT NULL`). */
  scored: number;
  /** Rows with `correct = false`. A subset of `scored`. */
  wrong: number;
  /** dont_know / not_sure self-ratings. NOT a subset of `scored`. */
  dontKnow: number;
}

export interface Mastery {
  state: MasteryState;
  /** (wrong + dontKnow) / evidence, or null when there is no evidence. */
  missRate: number | null;
  /** scored + dontKnow — every observation that COULD express a miss. */
  evidence: number;
}

/**
 * How well she knows this character, judged only on evidence that could have
 * gone either way.
 *
 * **Why `got_it` is excluded from the denominator.** In production every one
 * of the 164 flashcard self-ratings is `got_it` — not one `not_sure`, not one
 * `dont_know`, ever. A field whose every observation is identical carries no
 * information, and counting those rows would let five tapped-through cards
 * bury one genuinely failed answer. `dontKnow` stays in BOTH the numerator and
 * the denominator: a self-declared "I don't know this" is real evidence.
 *
 * **Why there is no decay.** This answers *what does she know*; `reviewScore`
 * answers *what should she practise* and models forgetting there. A badge that
 * vanished after a fortnight's gap would punish a child whose play is bursty
 * by nature.
 */
export function masteryForChar(input: MasteryInput): Mastery {
  const evidence = input.scored + input.dontKnow;
  if (evidence === 0) return { state: 'unrated', missRate: null, evidence: 0 };

  const missRate = (input.wrong + input.dontKnow) / evidence;
  if (evidence < MASTERY_MIN_EVIDENCE) return { state: 'unrated', missRate, evidence };

  const state: MasteryState =
    1 - missRate >= PROFICIENT_ACCURACY ? 'proficient' : 'learning';
  return { state, missRate, evidence };
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run tests/unit/mastery.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove the evidence gate is load-bearing**

Temporarily delete the line `if (evidence < MASTERY_MIN_EVIDENCE) return { state: 'unrated', missRate, evidence };` and re-run. Expected: the "unrated just below the evidence threshold" and "never returns proficient on evidence thinner than the threshold" tests FAIL. Paste the real output into your report, then restore the line.

- [ ] **Step 6: Full gate and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/mastery/mastery.ts tests/unit/mastery.test.ts
git commit -m "feat(mastery): masteryForChar — the single substrate over answer_events

Judged on evidence that could have gone either way. Every one of production's
164 flashcard self-ratings is got_it, so counting them would let five
tapped-through cards bury one genuinely failed answer. dontKnow stays in both
numerator and denominator, which also keeps missRate <= 1."
```

---

### Task 2: Rewrite `reviewScore` on it — the 温故 dilution fix

**Files:**
- Modify: `src/lib/review/selection.ts`
- Modify: `src/lib/db/review.ts`
- Modify: `tests/unit/review-selection.test.ts`
- Modify: `tests/unit/review-db.test.ts`

**Interfaces:**
- Consumes: `masteryForChar`, `Mastery` (Task 1).
- Produces: `ReviewCandidate` with `scored: number` **replacing** `total: number`. Fields `wrong`, `dontKnow`, `characterId`, `hanzi`, `weekNumber`, `daysSinceLastSeen` are unchanged.

**This task deliberately CHANGES 温故's output.** It is a behaviour fix, not a refactor. Do not write a characterization test pinning the old values, and if an existing test asserts an old score, update it and say so in your report.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/review-selection.test.ts`, inside the existing `describe('reviewScore')`. Note the `cand` helper at the top of that file has a `total` field — rename it to `scored` there in the same edit, or these will not compile:

```ts
  it('is not diluted by got_it flashcards — the PR #165 defect', () => {
    // The shipped formula divided misses by count(*), which included flashcard
    // rows that can never be `correct = false`. A character with five tapped-
    // through cards and one genuinely failed answer scored 1/6 (weakness 10)
    // instead of 1/1 (weakness 60) — a 50-point misranking that flattered
    // exactly the characters she had drilled most.
    //
    // Under the fix those five got_it rows are not in `scored` at all, so the
    // failed character must now outrank a clean one seen equally recently.
    const drilledButFailing = cand({
      characterId: 'c-fail',
      scored: 1,
      wrong: 1,
      dontKnow: 0,
      daysSinceLastSeen: 2,
    });
    // Staler on purpose: under the OLD formula its staleness (20) beat the
    // diluted weakness of the failing character (10 + 2 = 12), so the review
    // loop served the character she already knew. The ORDER is the assertion.
    const genuinelySolid = cand({
      characterId: 'c-solid',
      scored: 5,
      wrong: 0,
      dontKnow: 0,
      daysSinceLastSeen: 20,
    });
    expect(reviewScore(drilledButFailing)).toBeGreaterThan(reviewScore(genuinelySolid));
    expect(reviewScore(drilledButFailing)).toBe(60 + 2);
    expect(reviewScore(genuinelySolid)).toBe(0 + 20);
  });

  it('gives NEUTRAL weakness to a character met only through got_it flashcards', () => {
    // Those rows never reach the scorer, so this character has zero evidence —
    // the same position as one from a week cleared before A1 shipped. This
    // population is LARGER after the fix; that is intended, not a regression.
    expect(reviewScore(cand({ scored: 0, wrong: 0, dontKnow: 0, daysSinceLastSeen: 5 })))
      .toBe(NEUTRAL_WEAKNESS + 5);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run tests/unit/review-selection.test.ts`
Expected: FAIL — TypeScript/runtime errors on the unknown `scored` field, and the dilution assertion failing.

- [ ] **Step 3: Rewrite `reviewScore`**

In `src/lib/review/selection.ts`, add the import and replace the `total` field and the scorer body. Keep every existing doc comment — in particular the "Why this is not `bountyScore`" block, which records a decision the review process paid for.

```ts
import { masteryForChar } from '@/lib/mastery/mastery';
```

In `interface ReviewCandidate`, replace:

```ts
  /** All-time answer_events rows targeting this char. */
  total: number;
```

with:

```ts
  /**
   * answer_events rows targeting this char that carry a real verdict
   * (`correct IS NOT NULL`). Flashcard self-ratings are NOT counted here —
   * see masteryForChar's header for why `got_it` cannot be evidence.
   */
  scored: number;
```

Replace the body of `reviewScore` (keep the doc comment above it verbatim, and append the new paragraph):

```ts
export function reviewScore(c: ReviewCandidate): number {
  const m = masteryForChar(c);
  const weakness =
    m.missRate === null ? NEUTRAL_WEAKNESS : Math.round(60 * m.missRate);
  const staleness = Math.min(c.daysSinceLastSeen ?? STALE_DEFAULT_DAYS, STALE_CAP);
  return weakness + staleness;
}
```

Append to that function's doc comment, above the closing `*/`:

```
 *
 * The weakness half is `masteryForChar`'s, so the Logbook and 温故 can never
 * disagree about how well a character is known. That function's denominator
 * excludes `got_it` self-ratings, which is a deliberate BEHAVIOUR CHANGE from
 * the version shipped in PR #165: that one divided by `count(*)`, letting five
 * tapped-through flashcards bury one failed answer.
```

- [ ] **Step 4: Update the DB read**

In `src/lib/db/review.ts`, inside `fetchReviewData`'s `stats` select, replace:

```ts
      total: sql<number>`count(*)`,
```

with:

```ts
      scored: sql<number>`count(*) filter (where ${answerEvents.correct} is not null)`,
```

and in the `candidates` mapper replace `total: Number(s?.total ?? 0),` with `scored: Number(s?.scored ?? 0),`.

**Do NOT touch `src/lib/db/bounties.ts`.** It computes a `total: count(*)` for `bountyScore`, which ranks *unseen* characters and legitimately wants "has she met this at all". Changing it would alter 通缉令's selection, which is out of scope.

- [ ] **Step 5: Fix the select-count fixtures**

`tests/unit/review-db.test.ts` asserts exact select counts (4 for `getReviewCandidates`, 5 for `getReviewSessionData`). Adding a `filter` to an existing aggregate must NOT change either number. Update any stats row fixture that supplies `total` to supply `scored`, and re-run.

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run tests/unit/review-selection.test.ts tests/unit/review-db.test.ts tests/unit/review-session.test.ts tests/unit/review-action.test.ts`
Expected: PASS. Select counts still 4 and 5.

- [ ] **Step 7: Prove the fix bites**

Temporarily revert `reviewScore`'s weakness line to the pre-fix formula:

```ts
  const weakness =
    c.scored + c.dontKnow > 0
      ? Math.round((60 * (c.wrong + c.dontKnow)) / (c.scored + c.dontKnow + 5))
      : NEUTRAL_WEAKNESS;
```

(the `+ 5` stands in for the five `got_it` rows the old `count(*)` would have included). Re-run `tests/unit/review-selection.test.ts` and confirm the dilution test FAILS. Paste the real output, then restore.

- [ ] **Step 8: Full gate and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/review/selection.ts src/lib/db/review.ts tests/unit/review-selection.test.ts tests/unit/review-db.test.ts
git commit -m "fix(review): 温故's weakness was diluted by got_it flashcards

reviewScore divided misses by count(*), which includes flashcard rows that can
never be correct=false. Five tapped-through cards plus one failed answer scored
17% instead of 100% — a 50-point misranking on a 0-90 scale, flattering exactly
the characters she had drilled most.

ReviewCandidate.total becomes .scored, counting only rows with a real verdict,
and the weakness term now comes from masteryForChar so the Logbook and 温故
cannot disagree. Behaviour change, not a refactor: 温故 has zero plays in
production, so no child has experienced the old ranking."
```

---

### Task 3: The Logbook read

**Files:**
- Create: `src/lib/db/logbook.ts`
- Test: `tests/unit/logbook-db.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 at runtime; its output feeds `masteryForChar`.
- Produces:

```ts
export interface LogbookEntry {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  weekNumber: number;
  firstWord: string | null;
  sentence: string | null;
  scored: number;
  wrong: number;
  dontKnow: number;
}
export async function getLogbookEntries(childId: string): Promise<LogbookEntry[]>;
```

**Scope note:** this read is deliberately WIDER than `getReviewSessionData`. 温故 requires `bossCleared`; the Logbook shows every character in an **unlocked** week, including the week in progress — she is learning those now and they belong in her logbook.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/logbook-db.test.ts`:

```ts
// V1 — the Logbook read. Mirrors tests/unit/review-db.test.ts's queued-select
// harness; see that file's header for why the chain must be thenable.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn(), bossWeeks: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: (...a: unknown[]) => mocks.select(...a) } }));
vi.mock('@/lib/db/weeks', async (orig) => ({
  ...(await orig<typeof import('@/lib/db/weeks')>()),
  listBossWeekIds: (...a: unknown[]) => mocks.bossWeeks(...a),
}));

import { getLogbookEntries } from '@/lib/db/logbook';

/** Queue one resolved row-set per db.select(); every builder method chains. */
function queueSelects(rowSets: unknown[][]) {
  for (const rows of rowSets) {
    const chain: Record<string, unknown> = {};
    for (const m of ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'orderBy', 'limit']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res);
    mocks.select.mockReturnValueOnce(chain);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bossWeeks.mockResolvedValue(new Set(['w1']));
});

describe('getLogbookEntries', () => {
  it('returns nothing when the child has no playable weeks', async () => {
    queueSelects([[{ packId: 'p1' }], []]);
    await expect(getLogbookEntries('c1')).resolves.toEqual([]);
  });

  it('keeps a character with no telemetry at all, at zero evidence', async () => {
    // The Logbook must show every taught character. A character absent from
    // answer_events has to survive as an entry, not be dropped by a join —
    // 57 of production's 96 characters have only 1-2 scored answers.
    queueSelects([
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1 }],
      [{ weekId: 'w1', bossCleared: false }],
      [{ characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' }],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ hanzi: '一', scored: 0, wrong: 0, dontKnow: 0 });
  });

  it('excludes characters from weeks past the frontier', async () => {
    // T3 linear gating. Showing a locked week's characters would spoil unseen
    // content and inflate the denominator with characters she has never met.
    mocks.bossWeeks.mockResolvedValue(new Set(['w1', 'w2']));
    queueSelects([
      [{ packId: 'p1' }],
      [
        { weekId: 'w1', weekNumber: 1 },
        { weekId: 'w2', weekNumber: 2 },
        { weekId: 'w3', weekNumber: 3 },
      ],
      [], // no boss cleared → frontier is week 1
      [
        { characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' },
        { characterId: 'ch2', weekId: 'w2', hanzi: '二', pinyin: ['èr'], meaningEn: 'two' },
      ],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out.map((e) => e.hanzi)).toEqual(['一']);
  });

  it('splits scored answers from dont_know self-ratings', async () => {
    queueSelects([
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1 }],
      [{ weekId: 'w1', bossCleared: true }],
      [{ characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' }],
      [{ characterId: 'ch1', scored: 4, wrong: 1, dontKnow: 2 }],
      [{ characterId: 'ch1', text: '一起' }],
      [{ characterId: 'ch1', text: '我们一起走。' }],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out[0]).toMatchObject({
      scored: 4,
      wrong: 1,
      dontKnow: 2,
      firstWord: '一起',
      sentence: '我们一起走。',
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run tests/unit/logbook-db.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/db/logbook"`.

- [ ] **Step 3: Write the read**

Create `src/lib/db/logbook.ts`. Model the pack-visibility condition and the aggregate on `src/lib/db/review.ts`, and the unlock derivation on `src/app/play/[childId]/page.tsx:181-203`:

```ts
// V1 航海日志 — the read behind the Logbook. SERVER-ONLY, and deliberately NOT
// under src/lib/actions/: every exported async function in a 'use server' file
// is a public RPC endpoint, and this one takes a raw childId.
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { answerEvents } from '@/db/schema/answer-events';
import { childProfiles } from '@/db/schema/auth';
import {
  characterSentence,
  characterWord,
  characters,
  exampleSentences,
  weekCharacters,
  weeks,
  words,
} from '@/db/schema/content';
import { weekProgress } from '@/db/schema/game';
import { frontierWeekNumber, isWeekUnlockedFrom, listBossWeekIds } from '@/lib/db/weeks';

export interface LogbookEntry {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  weekNumber: number;
  firstWord: string | null;
  sentence: string | null;
  scored: number;
  wrong: number;
  dontKnow: number;
}

/**
 * Every character in a week the child has UNLOCKED, with the counts
 * `masteryForChar` needs.
 *
 * Wider than getReviewSessionData on purpose: 温故 reviews weeks she has
 * FINISHED (bossCleared), the Logbook shows what she is learning, including
 * the week in progress. Locked weeks stay out — showing them would spoil
 * unseen content and pad the total with characters she has never met.
 */
export async function getLogbookEntries(childId: string): Promise<LogbookEntry[]> {
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  const packId = child?.packId ?? null;

  const packCondition = packId
    ? and(
        eq(weeks.status, 'published'),
        or(eq(weeks.childId, childId), and(isNull(weeks.childId), eq(weeks.curriculumPackId, packId))),
      )
    : and(eq(weeks.status, 'published'), eq(weeks.childId, childId));

  const playable = await db
    .select({ weekId: weeks.id, weekNumber: weeks.weekNumber })
    .from(weeks)
    .where(packCondition);
  if (playable.length === 0) return [];

  const progress = await db
    .select({ weekId: weekProgress.weekId, bossCleared: weekProgress.bossCleared })
    .from(weekProgress)
    .where(eq(weekProgress.childId, childId));
  const clearedSet = new Set(progress.filter((p) => p.bossCleared).map((p) => p.weekId));

  // Same trio the home board uses, so the Logbook can never show a character
  // from an island the map paints as 🔒. A bossless week can never be cleared,
  // so leaving it in the candidate set would pin the frontier there forever.
  const bossWeekIds = await listBossWeekIds(playable.map((w) => w.weekId));
  const frontier = frontierWeekNumber(
    playable.map((w) => ({ id: w.weekId, weekNumber: w.weekNumber, hasBoss: bossWeekIds.has(w.weekId) })),
    clearedSet,
  );
  const unlocked = playable.filter((w) =>
    isWeekUnlockedFrom(w.weekNumber, frontier, clearedSet.has(w.weekId)),
  );
  if (unlocked.length === 0) return [];

  const weekNumberById = new Map(unlocked.map((w) => [w.weekId, w.weekNumber]));
  const weekIds = unlocked.map((w) => w.weekId);

  const charRows = await db
    .select({
      characterId: weekCharacters.characterId,
      weekId: weekCharacters.weekId,
      hanzi: characters.hanzi,
      pinyin: characters.pinyinArray,
      meaningEn: characters.meaningEn,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(inArray(weekCharacters.weekId, weekIds));
  if (charRows.length === 0) return [];

  // A character taught twice keeps its HIGHEST week number, matching how
  // review.ts ranks by most recent appearance.
  const byChar = new Map<string, Omit<LogbookEntry, 'scored' | 'wrong' | 'dontKnow' | 'firstWord' | 'sentence'>>();
  for (const r of charRows) {
    // Belt and braces against the WHERE above: a character whose week the gate
    // did not unlock is skipped outright rather than defaulting to week 0.
    // review.ts's `?? 0` would silently admit it as a week-zero entry.
    const wn = weekNumberById.get(r.weekId);
    if (wn === undefined) continue;
    const cur = byChar.get(r.characterId);
    if (!cur || wn > cur.weekNumber) {
      byChar.set(r.characterId, {
        characterId: r.characterId,
        hanzi: r.hanzi,
        pinyin: r.pinyin,
        meaningEn: r.meaningEn,
        weekNumber: wn,
      });
    }
  }
  const charIds = Array.from(byChar.keys());

  // LEFT JOIN semantics by construction: a character with no answer_events rows
  // has no stat row and defaults to zero evidence. 57 of the 96 characters in
  // production have only 1-2 scored answers, so this path is the common one.
  const stats = await db
    .select({
      characterId: answerEvents.characterId,
      scored: sql<number>`count(*) filter (where ${answerEvents.correct} is not null)`,
      wrong: sql<number>`count(*) filter (where ${answerEvents.correct} = false)`,
      dontKnow: sql<number>`count(*) filter (where ${answerEvents.selfRating} in ('dont_know', 'not_sure'))`,
    })
    .from(answerEvents)
    .where(and(eq(answerEvents.childId, childId), inArray(answerEvents.characterId, charIds)))
    .groupBy(answerEvents.characterId);
  const statByChar = new Map(stats.map((s) => [s.characterId as string, s]));

  // ORDER BY position is load-bearing: without it Postgres returns rows in
  // undefined order and the "first word" changes between refreshes.
  const wordRows = await db
    .select({ characterId: characterWord.characterId, text: words.text })
    .from(characterWord)
    .innerJoin(words, eq(words.id, characterWord.wordId))
    .where(inArray(characterWord.characterId, charIds))
    .orderBy(asc(characterWord.position));
  const firstWordByChar = new Map<string, string>();
  for (const w of wordRows) {
    if (!firstWordByChar.has(w.characterId)) firstWordByChar.set(w.characterId, w.text);
  }

  const sentenceRows = await db
    .select({ characterId: characterSentence.characterId, text: exampleSentences.text })
    .from(characterSentence)
    .innerJoin(exampleSentences, eq(exampleSentences.id, characterSentence.sentenceId))
    .where(inArray(characterSentence.characterId, charIds));
  const sentenceByChar = new Map<string, string>();
  for (const s of sentenceRows) {
    if (!sentenceByChar.has(s.characterId)) sentenceByChar.set(s.characterId, s.text);
  }

  return charIds.map((id) => {
    const meta = byChar.get(id)!;
    const s = statByChar.get(id);
    return {
      ...meta,
      firstWord: firstWordByChar.get(id) ?? null,
      sentence: sentenceByChar.get(id) ?? null,
      scored: Number(s?.scored ?? 0),
      wrong: Number(s?.wrong ?? 0),
      dontKnow: Number(s?.dontKnow ?? 0),
    };
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run tests/unit/logbook-db.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Prove the gating filter is load-bearing**

Temporarily replace `const unlocked = playable.filter(...)` with `const unlocked = playable;` and re-run. Expected: "excludes characters from weeks past the frontier" FAILS with `['一','二']` received. Paste the real output, then restore.

- [ ] **Step 6: Full gate and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/db/logbook.ts tests/unit/logbook-db.test.ts
git commit -m "feat(logbook): read every character in an unlocked week

Wider than 温故's pool on purpose — that reviews FINISHED weeks, the Logbook
shows what she is learning, including the week in progress. Locked weeks stay
out so the page cannot spoil unseen content or pad its total with characters
she has never met."
```

---

### Task 4: The Logbook grid

**Files:**
- Create: `src/components/play/LogbookGrid.tsx`
- Test: `tests/unit/logbook-grid.test.tsx`

**Interfaces:**
- Consumes: `MasteryState` (Task 1); `LogbookEntry` (Task 3).
- Produces: `interface LogbookTile { characterId, hanzi, pinyin: string[], meaningEn, firstWord, sentence, state: MasteryState }` and `LogbookGrid({ tiles }: { tiles: LogbookTile[] })`.

A `'use client'` component — tapping a tile opens its detail. It receives plain data only; never pass it a function-bearing object from the server page.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/logbook-grid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogbookGrid, type LogbookTile } from '@/components/play/LogbookGrid';

const tile = (over: Partial<LogbookTile>): LogbookTile => ({
  characterId: over.characterId ?? 'ch1',
  hanzi: over.hanzi ?? '一',
  pinyin: over.pinyin ?? ['yī'],
  meaningEn: over.meaningEn ?? 'one',
  firstWord: over.firstWord ?? '一起',
  sentence: over.sentence ?? '我们一起走。',
  state: over.state ?? 'unrated',
  ...over,
});

describe('LogbookGrid', () => {
  it('renders every taught character, badged or not', () => {
    render(<LogbookGrid tiles={[tile({ characterId: 'a', hanzi: '一' }), tile({ characterId: 'b', hanzi: '二' })]} />);
    expect(screen.getAllByTestId(/^logbook-tile-/)).toHaveLength(2);
  });

  it('badges a proficient character and says so in both languages', () => {
    render(<LogbookGrid tiles={[tile({ state: 'proficient' })]} />);
    const badge = screen.getByTestId('logbook-badge-ch1');
    expect(badge.textContent).toMatch(/熟练/);
    expect(badge.textContent).toMatch(/Solid/i);
  });

  it('shows NO badge on a character with too little evidence', () => {
    // An unearned badge is a false signal. A missing one is honest, and fills
    // in on its own — 57 of production's 96 characters sit here today.
    render(<LogbookGrid tiles={[tile({ state: 'unrated' })]} />);
    expect(screen.queryByTestId('logbook-badge-ch1')).toBeNull();
  });

  it('never renders a score, a percentage, or failure language', () => {
    // Standing product rule: nothing on a kid surface may read as a verdict.
    // 学习中 is the weakest thing this page may ever say about a character.
    render(
      <LogbookGrid
        tiles={[
          tile({ characterId: 'a', state: 'learning' }),
          tile({ characterId: 'b', state: 'unrated' }),
          tile({ characterId: 'c', state: 'proficient' }),
        ]}
      />,
    );
    const text = screen.getByTestId('logbook-grid').textContent ?? '';
    expect(text).not.toMatch(/%|错|失败|wrong|fail|needs work|weak/i);
  });

  it('opens a detail with meaning, first word and sentence on tap', async () => {
    render(<LogbookGrid tiles={[tile({})]} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch1'));
    const detail = screen.getByTestId('logbook-detail');
    expect(detail.textContent).toMatch(/one/);
    expect(detail.textContent).toMatch(/一起/);
    expect(detail.textContent).toMatch(/我们一起走。/);
  });

  it('renders a detail for a character with no word or sentence data', async () => {
    render(<LogbookGrid tiles={[tile({ firstWord: null, sentence: null, meaningEn: null })]} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch1'));
    expect(screen.getByTestId('logbook-detail')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run tests/unit/logbook-grid.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/play/LogbookGrid"`.

- [ ] **Step 3: Write the component**

Create `src/components/play/LogbookGrid.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { MasteryState } from '@/lib/mastery/mastery';
import { SpeakButton } from '@/components/ui/SpeakButton';

export interface LogbookTile {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  firstWord: string | null;
  sentence: string | null;
  state: MasteryState;
}

/**
 * 熟练 is the only decorated state. `learning` and `unrated` are deliberately
 * quiet — no colour, no percentage, no "needs work". A badge she has not
 * earned is a false signal, and a page that marks two thirds of her characters
 * as lacking is a report card, which this product is not.
 */
const BADGE: Record<MasteryState, { zh: string; en: string; cls: string } | null> = {
  proficient: {
    zh: '熟练',
    en: 'Solid',
    cls: 'bg-amber-300 text-amber-950 border-amber-400',
  },
  learning: {
    zh: '学习中',
    en: 'Learning',
    cls: 'bg-stone-100 text-stone-600 border-stone-300',
  },
  unrated: null,
};

export function LogbookGrid({ tiles }: { tiles: LogbookTile[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tiles.find((t) => t.characterId === openId) ?? null;

  return (
    <div className="w-full" data-testid="logbook-grid">
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {tiles.map((t) => {
          const badge = BADGE[t.state];
          return (
            <li key={t.characterId}>
              <button
                type="button"
                data-testid={`logbook-tile-${t.characterId}`}
                onClick={() => setOpenId(t.characterId)}
                aria-label={`${t.hanzi} ${t.pinyin.join(' ')}`}
                className="flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 border-stone-200 bg-white/90 px-1 py-2 transition hover:-translate-y-0.5 hover:border-amber-300"
              >
                <span className="font-hanzi text-3xl leading-none text-stone-800">{t.hanzi}</span>
                <span className="text-[10px] text-stone-500">{t.pinyin.join(' ')}</span>
                {badge ? (
                  <span
                    data-testid={`logbook-badge-${t.characterId}`}
                    className={`mt-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold ${badge.cls}`}
                  >
                    <span className="font-hanzi">{badge.zh}</span>{' '}
                    <span className="italic">{badge.en}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {open ? (
        <div
          data-testid="logbook-detail"
          className="mt-4 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-center"
        >
          <div className="font-hanzi text-6xl text-stone-800">{open.hanzi}</div>
          <div className="mt-1 text-sm text-stone-600">{open.pinyin.join(' ')}</div>
          {open.meaningEn ? (
            <div className="mt-1 text-base font-semibold text-stone-800">{open.meaningEn}</div>
          ) : null}
          {open.firstWord ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="font-hanzi text-xl text-stone-800">{open.firstWord}</span>
              <SpeakButton text={open.firstWord} />
            </div>
          ) : null}
          {open.sentence ? (
            <p className="mt-2 font-hanzi text-sm text-stone-700">{open.sentence}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="mt-4 rounded-full border-2 border-stone-300 bg-white px-4 py-1.5 text-sm font-semibold text-stone-700"
          >
            <span className="font-hanzi">关闭</span> <span className="italic">/ Close</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run tests/unit/logbook-grid.test.tsx`
Expected: PASS, 6 tests. If `SpeakButton`'s import path differs, check `src/components/ui/SpeakButton.tsx` and correct the import rather than removing the button.

- [ ] **Step 5: Prove the no-badge rule is load-bearing**

Temporarily change `unrated: null` in `BADGE` to `unrated: { zh: '生疏', en: 'Weak', cls: 'bg-red-200 text-red-900 border-red-400' }` and re-run. Expected: BOTH "shows NO badge" and "never renders a score, a percentage, or failure language" FAIL. Paste the real output, then restore. That second failure is the point: the product rule is enforced by a test, not by discipline.

- [ ] **Step 6: Full gate and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/components/play/LogbookGrid.tsx tests/unit/logbook-grid.test.tsx
git commit -m "feat(logbook): the 字 grid, badged only where earned

熟练 is the only decorated state. learning and unrated are deliberately quiet —
a badge she has not earned is a false signal, and a page that marks two thirds
of her characters as lacking is a report card. A test pins that nothing here
can ever render a percentage or failure language."
```

---

### Task 5: The route and the Backpack entry

**Files:**
- Create: `src/app/play/[childId]/collection/logbook/page.tsx`
- Create: `src/components/play/LogbookHallCard.tsx`
- Modify: `src/app/play/[childId]/collection/page.tsx`
- Test: `tests/unit/logbook-hall-card.test.tsx`

**Interfaces:**
- Consumes: `getLogbookEntries` (Task 3), `masteryForChar` (Task 1), `LogbookGrid` / `LogbookTile` (Task 4).
- Produces: route `/play/[childId]/collection/logbook`; `LogbookHallCard({ childId, totalCount, proficientCount })`.

Both new files are **server components** except `LogbookGrid`. `AtlasHub` and `AtlasHallCard` are server components today and pass a function-bearing `meta: PackUiMeta`; if anyone marks them `'use client'` later that breaks at request time and neither tests nor `pnpm build` catch it. Do not convert them.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/logbook-hall-card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogbookHallCard } from '@/components/play/LogbookHallCard';

describe('LogbookHallCard', () => {
  it('links into the Logbook and is bilingual', () => {
    render(<LogbookHallCard childId="c1" totalCount={96} proficientCount={31} />);
    const card = screen.getByTestId('atlas-hall-logbook');
    expect(card).toHaveAttribute('href', '/play/c1/collection/logbook');
    expect(card.textContent).toMatch(/航海日志/);
    expect(card.textContent).toMatch(/Logbook/i);
  });

  it('shows her own counts and never a comparison', () => {
    render(<LogbookHallCard childId="c1" totalCount={96} proficientCount={31} />);
    const text = screen.getByTestId('atlas-hall-logbook').textContent ?? '';
    expect(text).toMatch(/31/);
    expect(text).toMatch(/96/);
    expect(text).not.toMatch(/排名|rank|比|than|其他|other kid/i);
  });

  it('reads warmly at zero rather than as a failure', () => {
    // A brand-new child must not be told she has mastered nothing.
    render(<LogbookHallCard childId="c1" totalCount={0} proficientCount={0} />);
    const text = screen.getByTestId('atlas-hall-logbook').textContent ?? '';
    expect(text).not.toMatch(/没有|0 mastered|none|empty/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run tests/unit/logbook-hall-card.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/play/LogbookHallCard"`.

- [ ] **Step 3: Write the hall card**

Create `src/components/play/LogbookHallCard.tsx`, following `TrophiesHallCard`'s shape:

```tsx
import Link from 'next/link';

interface Props {
  childId: string;
  totalCount: number;
  proficientCount: number;
}

/**
 * Backpack entry to the 航海日志. Rendered beside TrophiesHallCard rather than
 * through PACK_REGISTRY: the Logbook is 1:1 with the curriculum and has no
 * rarity, no duplicates and no shard economy, so pack semantics buy nothing.
 */
export function LogbookHallCard({ childId, totalCount, proficientCount }: Props) {
  return (
    <Link
      href={`/play/${childId}/collection/logbook`}
      data-testid="atlas-hall-logbook"
      className="group block rounded-3xl border-2 border-sky-400 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4 rounded-t-[1.4rem] bg-gradient-to-br from-sky-200 via-sky-300 to-sky-400 p-5">
        <div className="text-5xl drop-shadow-sm" aria-hidden>📖</div>
        <div className="flex-1">
          <h2 className="font-hanzi text-2xl font-extrabold leading-tight text-sky-950">航海日志</h2>
          <p className="text-sm font-semibold text-sky-900">Captain&apos;s Logbook</p>
          <p className="mt-1 text-xs text-sky-900/80">你认识的每一个字,都记在这里。</p>
          <p className="text-[11px] italic text-sky-900/70">Every character you have met.</p>
        </div>
      </div>
      <div className="rounded-b-[1.4rem] bg-white/90 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-stone-700">
            <span className="font-hanzi">{totalCount} 个字</span>
            <span className="text-stone-500"> · {totalCount} characters</span>
            <div className="text-[11px] font-normal text-stone-500">
              <span className="font-hanzi">熟练 {proficientCount}</span>
              <span className="italic"> / {proficientCount} solid</span>
            </div>
          </div>
          <span className="text-sm font-bold text-sky-900 transition group-hover:translate-x-0.5">
            打开 / Open →
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Write the page**

Create `src/app/play/[childId]/collection/logbook/page.tsx`:

```tsx
import { requireChild } from '@/lib/auth/guards';
import { getLogbookEntries } from '@/lib/db/logbook';
import { masteryForChar } from '@/lib/mastery/mastery';
import { LogbookGrid, type LogbookTile } from '@/components/play/LogbookGrid';

export default async function LogbookPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  const entries = await getLogbookEntries(childId);
  const tiles: LogbookTile[] = entries.map((e) => ({
    characterId: e.characterId,
    hanzi: e.hanzi,
    pinyin: e.pinyin,
    meaningEn: e.meaningEn,
    firstWord: e.firstWord,
    sentence: e.sentence,
    state: masteryForChar(e).state,
  }));
  const proficient = tiles.filter((t) => t.state === 'proficient').length;

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-6">
      <header className="w-full max-w-md rounded-3xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-sky-100 to-sky-200 p-5 text-center text-sky-950">
        <h1 className="font-hanzi text-2xl font-extrabold">航海日志</h1>
        <p className="text-sm font-semibold">Captain&apos;s Logbook</p>
        <p className="mt-1 text-xs text-sky-900/80">
          <span className="font-hanzi">{tiles.length} 个字 · 熟练 {proficient}</span>
        </p>
        <p className="text-[11px] italic text-sky-900/70">
          {tiles.length} characters · {proficient} solid
        </p>
      </header>

      <div className="w-full max-w-md">
        {tiles.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-sky-300 bg-white/70 p-6 text-center text-sm text-sky-900">
            <span className="font-hanzi block">出发去第一座岛,开始写你的日志吧!</span>
            <span className="mt-1 block italic text-sky-900/70">
              Sail to your first island and start your logbook!
            </span>
          </p>
        ) : (
          <LogbookGrid tiles={tiles} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Mount the hall card**

In `src/app/play/[childId]/collection/page.tsx`:

1. Add imports:

```ts
import { LogbookHallCard } from '@/components/play/LogbookHallCard';
import { getLogbookEntries } from '@/lib/db/logbook';
import { masteryForChar } from '@/lib/mastery/mastery';
```

2. Add `getLogbookEntries(childId)` as a new entry to the existing `Promise.all` and `logbookEntries` to the destructuring **at the same index**. The array currently has 5 entries destructured as `[packs, allTrophies, earnedTrophies, recentItems, shards]`; append the call last and append the name last. Count both lists element by element before running anything — a mismatch still typechecks whenever two adjacent entries have compatible types.

3. Below the existing `<TrophiesHallCard … />` block, add:

```tsx
      <div className="w-full max-w-md">
        <LogbookHallCard
          childId={childId}
          totalCount={logbookEntries.length}
          proficientCount={
            logbookEntries.filter((e) => masteryForChar(e).state === 'proficient').length
          }
        />
      </div>
```

- [ ] **Step 6: Run the tests and the build**

```bash
pnpm vitest run tests/unit/logbook-hall-card.test.tsx
pnpm test && pnpm typecheck && pnpm lint && npx next build
```
Expected: all green, and the build output lists `ƒ /play/[childId]/collection/logbook`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/play/[childId]/collection/logbook/page.tsx" src/components/play/LogbookHallCard.tsx "src/app/play/[childId]/collection/page.tsx" tests/unit/logbook-hall-card.test.tsx
git commit -m "feat(logbook): 航海日志 route and Backpack entry

A hall card beside TrophiesHallCard rather than a 7th nav tab, and a page whose
header counts only her own progress. The empty state invites her to sail rather
than reporting that she has mastered nothing."
```

---

### Task 6: Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PLAN.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/IMPROVEMENT-ROADMAP.md`

- [ ] **Step 1: Add the landmines**

Under **Play loop & scenes** in `CLAUDE.md` — that is where the 温故 landmines already live, and the dilution fix is a play-loop behaviour change:

> **Landmine:** *`got_it` self-ratings are a CONSTANT in production — never let them into a mastery denominator.* All 164 flashcard self-ratings in prod are `got_it`; not one `not_sure`, not one `dont_know`, ever. A field whose every observation is identical carries no information, and 温故 shipped (PR #165) dividing misses by `count(*)`, which included those rows — five tapped-through cards buried one genuinely failed answer, scoring 17% instead of 100%, a 50-point misranking on a 0–90 scale that flattered exactly the characters she had drilled most. `masteryForChar` (`src/lib/mastery/mastery.ts`) counts `evidence = scored + dontKnow`, where `scored` is `correct IS NOT NULL`. `dontKnow` sits in BOTH numerator and denominator (a self-declared "I don't know" is real evidence, and it keeps `missRate <= 1` — dividing `wrong + dontKnow` by `scored` alone can exceed 1 and yield a weakness of 100 on a scale meant to top out at 60). `bounties.ts` deliberately still uses `count(*)`: `bountyScore` ranks UNSEEN characters and legitimately wants "has she met this at all".

> **Landmine:** *There is ONE mastery function and two readers — don't add a third scorer.* `masteryForChar` backs both the 航海日志 Logbook (display) and `reviewScore` (温故's ranking), so the two can never disagree about how well a character is known. V2 smart distractors and A3 parent insights must read the same function rather than inventing their own. It is pure, client-safe and deliberately NOT a stored column — the corpus is 96 characters and hundreds of events; cache only when measurably slow.

> **Landmine:** *The Logbook's pool is UNLOCKED weeks; 温故's is CLEARED weeks. They are different on purpose.* `getLogbookEntries` shows what she is learning, including the week in progress; `getReviewSessionData` reviews only weeks whose boss has fallen. The Logbook derives unlocking with the same `listBossWeekIds` + `frontierWeekNumber` + `isWeekUnlockedFrom` trio the home board uses, so it can never show a character from an island the map paints 🔒 — change the rule in the pure helpers so every surface moves together. And mastery NEVER decays in the Logbook: staleness lives in `reviewScore`, where it decides what to practise. A badge that vanished after a gap would punish a child whose play is bursty (151 events one day, then a fortnight of nothing).

- [ ] **Step 2: Update the snapshot and window**

Add a **航海日志 Logbook & mastery (V1)** paragraph to the subsystem snapshot near the bounties/温故 paragraphs, refresh the "last refreshed" date to the merge date and the PR number to **#167**, and roll the 3-PR recent-changes window to #167/#166/#165.

- [ ] **Step 3: PLAN.md, CHANGELOG.md, roadmap**

One row in `PLAN.md` §1. The full narrative in `docs/CHANGELOG.md` — include the telemetry read that shaped the design (489 events; 164 `correct IS NULL`; 90% real accuracy, not the 57% a naive count suggests; 57 of 96 characters with only 1–2 scored answers), why the thresholds are 3/80% and what they yield today (31 熟练 / 8 学习中 / 57 unbadged), and the 温故 dilution fix. In `docs/IMPROVEMENT-ROADMAP.md`, mark **V1 `[x]`** (shipped 2026-09-04, PR #167), and add a note under it that the degenerate `got_it` signal is an open UX follow-up on `FlashcardScene` — until someone looks at its button layout, a third of the telemetry is a constant.

- [ ] **Step 4: Commit**

```bash
pnpm test
git add CLAUDE.md PLAN.md docs/CHANGELOG.md docs/IMPROVEMENT-ROADMAP.md
git commit -m "docs(logbook): snapshot, landmines, changelog for V1"
```

---

## Post-merge operations

**None.** No migration, no recompile, no seed script, no art generation, no Blob operations. `answer_events` is read-only throughout.

Optional sanity check after she next plays: open `/play/<childId>/collection/logbook` and confirm the 熟练 count is in the region of 31 of 96 — materially higher would suggest `got_it` rows leaked back into the denominator.
