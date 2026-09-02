# 温故 Daily Review Loop (A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A short, optional, once-a-day mixed-review session drawn from characters in weeks the child has already cleared — the first thing in the game that brings a learned character back after its week ends.

**Architecture:** Two pure engines (scoring, session building) with no db imports, a thin server-only read layer over `answer_events`, one server action mirroring `finishStudyLessonAction`'s reward pattern, and a client runner reusing `MultipleChoiceQuiz` exactly as `StudyRunner` does. Questions are built at request time — no `week_levels` rows, no compile step, no recompile.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM + Neon Postgres, Vitest + React Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-25-daily-review-loop-design.md`

## Global Constraints

- **Bilingual chrome on every kid-facing label** — `中文 / English`, ZH first. Use `bi(zh, en)` from `@/lib/i18n/bilingual`, or a ZH-span + EN-span pair.
- **温故 gates nothing.** Boss unlock still counts practice only. Nothing anywhere may require this session to have been played.
- **The reward pays on completion, not on score.** `score` is recorded and returned for the summary, but no reward branches on it — the same reasoning as `boss_courage` paying out on a *failed* boss. This product does not test her.
- **`ANSWER_SOURCES` already contains `'review'`** — that is the per-week flashcard *section*. This feature's source MUST be `'daily_review'`. Reusing `'review'` would make the two indistinguishable in `answer_events` and corrupt the exact signal the feature is built on.
- **Pure modules under `src/lib/review/` import nothing from `@/db` or `@/lib/db/*`.** A test for them must never need `vi.mock('@/db')`.
- **`src/lib/db/review.ts` is a plain server module, never `'use server'`** — every exported async function in a `'use server'` file is a public RPC endpoint.
- **The server action opens with `requireChild(childId)`.**
- **Any long-session route must mount `<MidSceneFlag />`** or `KidNavBar` tab taps navigate away without the quit-confirm.
- **Scene option shuffles are keyed on a stable primitive id**, never on a prop object's identity.
- **`pnpm typecheck && pnpm lint && pnpm test` green at every commit.** Run the FULL suite. Do NOT run `pnpm build` (it migrates a live database); use `npx next build` for a compile check.
- **Migrations are append-only.** Generate, never hand-edit.

---

## File Structure

**New — pure, client-safe (no db imports):**
- `src/lib/review/selection.ts` — which characters to review, and why.
- `src/lib/review/session.ts` — turning chosen characters into playable questions.

**New — server-only:**
- `src/lib/db/review.ts` — the candidate + pool read over `answer_events`.
- `src/lib/actions/review.ts` — `finishReviewAction`.

**New — UI:**
- `src/components/play/ReviewRunner.tsx` — client runner over `MultipleChoiceQuiz`.
- `src/app/play/[childId]/review/page.tsx` — the route.
- `src/components/play/DailyReviewCard.tsx` — the home entry card.

**Modified:**
- `src/db/schema/economy.ts` — `'daily_review'` in the `coinReason` pgEnum.
- `src/lib/db/xp.ts` — `'daily_review'` in `XpSource`.
- `src/lib/db/grants.ts` — `'daily_review'` in `pullCardInTx`'s `source` union.
- `src/lib/db/coins.ts` — `'daily_review'` in `AwardCoinReason`.
- `src/lib/play/answer-events.ts` — `'daily_review'` in `ANSWER_SOURCES`.
- `src/app/play/[childId]/page.tsx` — mount the entry card.

---

## Task 1: Selection engine

Pure scoring and picking. No dependencies, so it comes first.

**Files:**
- Create: `src/lib/review/selection.ts`
- Test: `tests/unit/review-selection.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ReviewCandidate { characterId: string; hanzi: string; weekNumber: number; total: number; wrong: number; dontKnow: number; daysSinceLastSeen: number | null }`
  - `reviewScore(c: ReviewCandidate): number`
  - `pickReviewTargets(candidates: ReviewCandidate[], count?: number): ReviewCandidate[]`
  - `REVIEW_SESSION_SIZE`, `NEUTRAL_WEAKNESS`, `STALE_DEFAULT_DAYS`, `STALE_CAP`, `REVIEW_REWARD_COINS`, `REVIEW_REWARD_XP`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-selection.test.ts`:

```ts
// A2 温故 — pure selection engine. Second consumer of the A1 answer_events
// telemetry after T2 bounties, and deliberately NOT scored the same way.
import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_WEAKNESS,
  REVIEW_SESSION_SIZE,
  STALE_CAP,
  pickReviewTargets,
  reviewScore,
  type ReviewCandidate,
} from '@/lib/review/selection';

const cand = (over: Partial<ReviewCandidate>): ReviewCandidate => ({
  characterId: over.characterId ?? 'c-x',
  hanzi: over.hanzi ?? '字',
  weekNumber: over.weekNumber ?? 1,
  total: over.total ?? 0,
  wrong: over.wrong ?? 0,
  dontKnow: over.dontKnow ?? 0,
  daysSinceLastSeen: over.daysSinceLastSeen ?? null,
  ...over,
});

describe('reviewScore', () => {
  it('scores a character she keeps missing above one she always gets right', () => {
    const weak = reviewScore(cand({ total: 10, wrong: 8, daysSinceLastSeen: 5 }));
    const solid = reviewScore(cand({ total: 10, wrong: 0, daysSinceLastSeen: 5 }));
    expect(weak).toBeGreaterThan(solid);
  });

  it('counts a "don\'t know" self-rating as a miss', () => {
    const rated = reviewScore(cand({ total: 10, dontKnow: 8, daysSinceLastSeen: 5 }));
    const clean = reviewScore(cand({ total: 10, daysSinceLastSeen: 5 }));
    expect(rated).toBeGreaterThan(clean);
  });

  it('raises the score the longer a character has gone unseen', () => {
    const stale = reviewScore(cand({ total: 10, wrong: 2, daysSinceLastSeen: 20 }));
    const fresh = reviewScore(cand({ total: 10, wrong: 2, daysSinceLastSeen: 1 }));
    expect(stale).toBeGreaterThan(fresh);
  });

  it('caps staleness so an ancient character cannot dominate forever', () => {
    const old = reviewScore(cand({ total: 10, wrong: 2, daysSinceLastSeen: STALE_CAP }));
    const ancient = reviewScore(cand({ total: 10, wrong: 2, daysSinceLastSeen: 9999 }));
    expect(ancient).toBe(old);
  });

  it('gives an untelemetered character a NEUTRAL weakness, not a maximal one', () => {
    // THE anti-bountyScore assertion. answer_events only started 2026-07-03,
    // so every character from a week cleared before that has total === 0
    // despite being thoroughly learned. bountyScore ranks those above every
    // weak character (`total === 0 → 100 + weekNumber`) because bounties push
    // her into UNVISITED weeks. Review targets the opposite population, so
    // reusing that scorer would let pre-telemetry characters crowd out
    // genuinely weak ones indefinitely.
    const unseen = reviewScore(cand({ total: 0, daysSinceLastSeen: null }));
    const veryWeak = reviewScore(cand({ total: 10, wrong: 10, daysSinceLastSeen: 5 }));
    expect(unseen).toBeLessThan(veryWeak);
    expect(unseen).toBeGreaterThan(reviewScore(cand({ total: 10, wrong: 0, daysSinceLastSeen: 5 })));
  });

  it('treats a never-seen character as moderately stale rather than infinitely so', () => {
    const nullSeen = reviewScore(cand({ total: 0, daysSinceLastSeen: null }));
    expect(nullSeen).toBe(NEUTRAL_WEAKNESS + 14);
  });
});

describe('pickReviewTargets', () => {
  it('returns the highest-scoring characters, most urgent first', () => {
    const picked = pickReviewTargets(
      [
        cand({ characterId: 'a', total: 10, wrong: 0, daysSinceLastSeen: 1 }),
        cand({ characterId: 'b', total: 10, wrong: 9, daysSinceLastSeen: 25 }),
        cand({ characterId: 'c', total: 10, wrong: 5, daysSinceLastSeen: 10 }),
      ],
      2,
    );
    expect(picked.map((p) => p.characterId)).toEqual(['b', 'c']);
  });

  it('is deterministic — ties break by later week, then hanzi', () => {
    const a = cand({ characterId: 'a', hanzi: '安', weekNumber: 2, total: 4, wrong: 2, daysSinceLastSeen: 3 });
    const b = cand({ characterId: 'b', hanzi: '本', weekNumber: 5, total: 4, wrong: 2, daysSinceLastSeen: 3 });
    expect(pickReviewTargets([a, b], 2).map((p) => p.characterId)).toEqual(['b', 'a']);
    expect(pickReviewTargets([b, a], 2).map((p) => p.characterId)).toEqual(['b', 'a']);
  });

  it('returns fewer than asked rather than throwing when candidates are short', () => {
    expect(pickReviewTargets([cand({ characterId: 'a' })], REVIEW_SESSION_SIZE)).toHaveLength(1);
    expect(pickReviewTargets([], REVIEW_SESSION_SIZE)).toEqual([]);
  });

  it('never returns the same character twice', () => {
    const one = cand({ characterId: 'a' });
    const picked = pickReviewTargets([one, one, one], 3);
    expect(new Set(picked.map((p) => p.characterId)).size).toBe(picked.length);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/review-selection.test.ts`
Expected: FAIL — `Cannot find module '@/lib/review/selection'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/review/selection.ts`:

```ts
// A2 温故 — pure review-selection engine (client-safe, no db imports).
// Second consumer of the A1 answer_events telemetry, after T2 bounties.

/** Questions in one 温故 session. */
export const REVIEW_SESSION_SIZE = 6;

/** Weakness assigned to a character with no telemetry at all. */
export const NEUTRAL_WEAKNESS = 20;

/** Staleness assumed for a character never seen in the telemetry window. */
export const STALE_DEFAULT_DAYS = 14;

/** Staleness stops accumulating here. */
export const STALE_CAP = 30;

export const REVIEW_REWARD_COINS = 40;
export const REVIEW_REWARD_XP = 15;

export interface ReviewCandidate {
  characterId: string;
  hanzi: string;
  weekNumber: number;
  /** All-time answer_events rows targeting this char. */
  total: number;
  /** correct = false rows. */
  wrong: number;
  /** dont_know / not_sure self-ratings. */
  dontKnow: number;
  /** Days since the most recent event, or null when there is none. */
  daysSinceLastSeen: number | null;
}

/**
 * How much this character wants reviewing. Higher = sooner.
 *
 * **Why this is not `bountyScore`.** That scorer ranks a never-answered
 * character above every weak one (`total === 0 → 100 + weekNumber`) because
 * bounties exist to push the child into *unvisited later weeks* — the
 * avoidance behaviour T2 targets. Review targets the opposite population:
 * characters she has already cleared and is now forgetting. Reusing it would
 * fail twice — every character from a week cleared before answer_events
 * started (2026-07-03) has `total === 0` despite being well learned and would
 * score 100+, and recency, the core forgetting signal, is not modelled at all.
 */
export function reviewScore(c: ReviewCandidate): number {
  const weakness =
    c.total > 0
      ? Math.round((60 * (c.wrong + c.dontKnow)) / c.total)
      : NEUTRAL_WEAKNESS;
  const staleness = Math.min(c.daysSinceLastSeen ?? STALE_DEFAULT_DAYS, STALE_CAP);
  return weakness + staleness;
}

/**
 * Today's review targets: top `count` by score. Deterministic — ties break by
 * `weekNumber` desc then `hanzi`, mirroring `pickBounties`, so the same input
 * always yields the same session.
 */
export function pickReviewTargets(
  candidates: ReviewCandidate[],
  count: number = REVIEW_SESSION_SIZE,
): ReviewCandidate[] {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.characterId)) return false;
    seen.add(c.characterId);
    return true;
  });

  return unique
    .map((c) => ({ c, score: reviewScore(c) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.c.weekNumber - a.c.weekNumber ||
        a.c.hanzi.localeCompare(b.c.hanzi),
    )
    .slice(0, count)
    .map((x) => x.c);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/review-selection.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/lib/review/selection.ts tests/unit/review-selection.test.ts
git commit -m "feat(review): 温故 selection engine

Deliberately not bountyScore: that ranks never-answered characters above every
weak one, which is right for pushing into unvisited weeks and backwards for
retention. Blends error rate with time since last seen, and gives an
untelemetered character a NEUTRAL weakness so pre-2026-07-03 characters cannot
crowd out genuinely weak ones."
```

---

## Task 2: Session builder, with the cross-week ambiguity guard

Turns chosen characters into playable questions. This is the task that reopens PR #158's bug if done carelessly.

**Files:**
- Create: `src/lib/review/session.ts`
- Test: `tests/unit/review-session.test.ts`

**Interfaces:**
- Consumes: `ReviewCandidate` (Task 1); `validStimulusWords` from `@/lib/scenes/stimulus-validity`.
- Produces:
  - `interface ReviewPoolChar { characterId: string; hanzi: string; meaningEn: string | null; words: ReviewPoolWord[] }`
  - `interface ReviewPoolWord { wordId: string; text: string; imageUrl: string | null }`
  - `type ReviewQuestionType = 'translate_pick' | 'audio_pick' | 'image_pick'`
  - `interface ReviewQuestion { id: string; type: ReviewQuestionType; targetCharacterId: string; stimulusWordId: string | null; choiceCharacterIds: string[] }`
  - `buildWordOwners(pool: ReviewPoolChar[]): Map<string, Set<string>>`
  - `buildReviewSession(targets: ReviewCandidate[], pool: ReviewPoolChar[], rng?: () => number): ReviewQuestion[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-session.test.ts`:

```ts
// A2 温故 — pure session builder. The load-bearing test here is the cross-week
// ambiguity guard: 温故's pool is cross-week BY DEFINITION, which reopens the
// exact bug PR #158 fixed for single weeks.
import { describe, expect, it } from 'vitest';
import {
  buildReviewSession,
  buildWordOwners,
  type ReviewPoolChar,
} from '@/lib/review/session';
import type { ReviewCandidate } from '@/lib/review/selection';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const target = (id: string, hanzi: string): ReviewCandidate => ({
  characterId: id,
  hanzi,
  weekNumber: 1,
  total: 4,
  wrong: 2,
  dontKnow: 0,
  daysSinceLastSeen: 5,
});

const poolChar = (
  id: string,
  hanzi: string,
  meaningEn: string | null,
  words: { wordId: string; text: string; imageUrl: string | null }[] = [],
): ReviewPoolChar => ({ characterId: id, hanzi, meaningEn, words });

/** Four plain characters with distinct meanings — enough for any MCQ. */
const BASE_POOL = [
  poolChar('c1', '猫', 'cat'),
  poolChar('c2', '狗', 'dog'),
  poolChar('c3', '鸟', 'bird'),
  poolChar('c4', '鱼', 'fish'),
];

describe('buildWordOwners', () => {
  it('maps a word to EVERY character that owns it, across the whole pool', () => {
    const owners = buildWordOwners([
      poolChar('sing', '唱', 'sing', [{ wordId: 'w1', text: '唱歌', imageUrl: 'http://x/1.png' }]),
      poolChar('song', '歌', 'song', [{ wordId: 'w2', text: '唱歌', imageUrl: 'http://x/1.png' }]),
    ]);
    // Keyed on HANZI, matching validStimulusWords' documented contract
    // ("word TEXT -> the set of hanzi that word is linked to").
    expect(owners.get('唱歌')).toEqual(new Set(['唱', '歌']));
  });
});

describe('buildReviewSession — the PR #158 hazard, cross-week', () => {
  it('never offers an image_pick whose picture two POOL characters could answer', () => {
    // 唱歌 is owned by 唱 and 歌. In a single week PR #158 already rejects this;
    // 温故's pool spans weeks, so the same collision returns one week over —
    // the picture would have TWO correct answers and the scene no right one.
    const pool = [
      poolChar('sing', '唱', 'sing', [{ wordId: 'w1', text: '唱歌', imageUrl: 'http://x/1.png' }]),
      poolChar('song', '歌', 'song', [{ wordId: 'w2', text: '唱歌', imageUrl: 'http://x/1.png' }]),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('sing', '唱')], pool, seq([0.9]));
    for (const q of questions) {
      expect(q.type).not.toBe('image_pick');
    }
  });

  it('DOES offer an image_pick when the picture is unambiguous', () => {
    const pool = [
      poolChar('cat', '猫', 'cat', [{ wordId: 'w9', text: '小猫', imageUrl: 'http://x/9.png' }]),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('cat', '猫')], pool, seq([0.9]));
    expect(questions[0].type).toBe('image_pick');
    expect(questions[0].stimulusWordId).toBe('w9');
  });

  it('never offers an image_pick for a counting character', () => {
    // 一…十 hinge on a count diffusion art cannot render (PR #158).
    const pool = [
      poolChar('seven', '七', 'seven', [{ wordId: 'w7', text: '七个', imageUrl: 'http://x/7.png' }]),
      ...BASE_POOL,
    ];
    const questions = buildReviewSession([target('seven', '七')], pool, seq([0.9]));
    for (const q of questions) expect(q.type).not.toBe('image_pick');
  });
});

describe('buildReviewSession', () => {
  it('builds one question per target', () => {
    const qs = buildReviewSession(
      [target('c1', '猫'), target('c2', '狗')],
      BASE_POOL,
      seq([0.1]),
    );
    expect(qs).toHaveLength(2);
    expect(qs.map((q) => q.targetCharacterId)).toEqual(['c1', 'c2']);
  });

  it('always includes the target among the choices, with 4 distinct choices', () => {
    for (const q of buildReviewSession([target('c1', '猫')], BASE_POOL, seq([0.1]))) {
      expect(q.choiceCharacterIds).toContain(q.targetCharacterId);
      expect(q.choiceCharacterIds).toHaveLength(4);
      expect(new Set(q.choiceCharacterIds).size).toBe(4);
    }
  });

  it('drops a target that can support no question type at all', () => {
    // No meaning, no art, and a pool too small for an audio MCQ.
    const tiny = [poolChar('lonely', '孤', null), poolChar('other', '他', null)];
    expect(buildReviewSession([target('lonely', '孤')], tiny, seq([0.1]))).toEqual([]);
  });

  it('is deterministic under an injected rng', () => {
    const a = buildReviewSession([target('c1', '猫')], BASE_POOL, seq([0.42]));
    const b = buildReviewSession([target('c1', '猫')], BASE_POOL, seq([0.42]));
    expect(a).toEqual(b);
  });

  it('gives every question a stable unique id', () => {
    const qs = buildReviewSession(
      [target('c1', '猫'), target('c2', '狗')],
      BASE_POOL,
      seq([0.1]),
    );
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/review-session.test.ts`
Expected: FAIL — `Cannot find module '@/lib/review/session'`.

- [ ] **Step 3: Write the ambiguity guard FIRST, and watch it catch the bug**

Before writing the real `buildReviewSession`, write a deliberately UNGUARDED version that picks any word with art:

```ts
// TEMPORARY — do not commit. Proving the guard test bites.
const stimulus = char.words.find((w) => w.imageUrl) ?? null;
```

Run: `pnpm vitest run tests/unit/review-session.test.ts -t "two POOL characters"`
Expected: **FAIL.** If it passes, the test is not testing what it claims and must be fixed before continuing. Per the PR #158 lesson, a guard whose test never failed against the unguarded code is decorative.

- [ ] **Step 4: Write the real implementation**

Create `src/lib/review/session.ts`:

```ts
// A2 温故 — pure session builder (client-safe, no db imports).
//
// Questions are built at REQUEST time: no week_levels rows, no scene_templates
// row, no compile step, and therefore no recompile-all-weeks.ts post-merge.
import { validStimulusWords } from '@/lib/scenes/stimulus-validity';
import type { ReviewCandidate } from './selection';

export interface ReviewPoolWord {
  wordId: string;
  text: string;
  imageUrl: string | null;
}

export interface ReviewPoolChar {
  characterId: string;
  hanzi: string;
  meaningEn: string | null;
  words: ReviewPoolWord[];
}

export type ReviewQuestionType = 'translate_pick' | 'audio_pick' | 'image_pick';

export interface ReviewQuestion {
  id: string;
  type: ReviewQuestionType;
  targetCharacterId: string;
  /** image_pick only: the word whose picture is shown, frozen at build time. */
  stimulusWordId: string | null;
  /** Includes the target. Shuffled. */
  choiceCharacterIds: string[];
}

const CHOICE_COUNT = 4;

/**
 * word text → the set of HANZI in the pool that own it.
 *
 * Keyed on hanzi, not characterId, to match `validStimulusWords`' documented
 * contract exactly. (`characters` is unique on `(hanzi, script)`, so the two
 * are 1:1 and only `.size` is read — but matching the contract means the next
 * reader does not have to re-derive that.)
 *
 * Built over the ENTIRE review pool, not one week. `validStimulusWords`
 * (PR #158) rejects a stimulus word shared with another character *in the pool
 * distractors are drawn from*; 温故's pool is cross-week by definition, so a
 * map built per-week would let the 唱歌 collision (唱 correct, 歌 offered as a
 * distractor, no right answer) return one week over.
 */
export function buildWordOwners(
  pool: ReviewPoolChar[],
): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const char of pool) {
    for (const w of char.words) {
      const set = owners.get(w.text) ?? new Set<string>();
      set.add(char.hanzi);
      owners.set(w.text, set);
    }
  }
  return owners;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one question per target, dropping any target the pool cannot support.
 *
 * Type eligibility, all judged AGAINST THE CROSS-WEEK POOL:
 *   translate_pick — target has meaningEn; >= 3 others with a different one
 *   audio_pick     — >= 3 other characters (device TTS: correct by construction)
 *   image_pick     — a VALID stimulus word (see buildWordOwners); >= 3 others
 */
export function buildReviewSession(
  targets: ReviewCandidate[],
  pool: ReviewPoolChar[],
  rng: () => number = Math.random,
): ReviewQuestion[] {
  const byId = new Map(pool.map((c) => [c.characterId, c]));
  const wordOwners = buildWordOwners(pool);
  const questions: ReviewQuestion[] = [];

  targets.forEach((t, index) => {
    const char = byId.get(t.characterId);
    if (!char) return;

    const others = pool.filter((c) => c.characterId !== char.characterId);
    if (others.length < CHOICE_COUNT - 1) return;

    const types: ReviewQuestionType[] = [];

    // A picture that cannot identify its own answer is worse than no picture.
    const validWords = validStimulusWords(
      char.hanzi,
      char.words.map((w) => ({ wordId: w.wordId, text: w.text, imageUrl: w.imageUrl })),
      wordOwners,
    );
    if (validWords.length > 0) types.push('image_pick');

    if (
      char.meaningEn &&
      others.filter((c) => c.meaningEn && c.meaningEn !== char.meaningEn).length >=
        CHOICE_COUNT - 1
    ) {
      types.push('translate_pick');
    }

    types.push('audio_pick');

    const type = types[Math.floor(rng() * types.length)] ?? 'audio_pick';

    const distractorPool =
      type === 'translate_pick'
        ? others.filter((c) => c.meaningEn && c.meaningEn !== char.meaningEn)
        : others;
    const distractors = shuffle(distractorPool, rng).slice(0, CHOICE_COUNT - 1);
    if (distractors.length < CHOICE_COUNT - 1) return;

    questions.push({
      id: `${type}:${char.characterId}:${index}`,
      type,
      targetCharacterId: char.characterId,
      stimulusWordId: type === 'image_pick' ? validWords[0].wordId : null,
      choiceCharacterIds: shuffle(
        [char.characterId, ...distractors.map((d) => d.characterId)],
        rng,
      ),
    });
  });

  return questions;
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/review-session.test.ts`
Expected: PASS, 9 tests. Confirm the ungainly temporary code from Step 3 is gone: `git diff` should show no `words.find((w) => w.imageUrl)`.

- [ ] **Step 6: Full suite, typecheck, lint, commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/review/session.ts tests/unit/review-session.test.ts
git commit -m "feat(review): 温故 session builder, with the cross-week ambiguity guard

Questions are built at request time — no week_levels rows, no compile, no
recompile post-merge.

buildWordOwners spans the WHOLE review pool, not one week. PR #158 rejects a
stimulus word shared with another character in the pool distractors come from;
温故's pool is cross-week by definition, so a per-week map would let the 唱歌
collision (唱 correct, 歌 offered as a distractor, no right answer) come back
one week over. The guard test was run against an unguarded builder and watched
to fail before the guard was written."
```

---

## Task 3: Schema and union edits (migration 0042)

**Files:**
- Modify: `src/db/schema/economy.ts` (`coinReason` pgEnum)
- Modify: `src/lib/db/coins.ts` (`AwardCoinReason`)
- Modify: `src/lib/db/xp.ts` (`XpSource`)
- Modify: `src/lib/db/grants.ts` (`pullCardInTx`'s `source` union)
- Modify: `src/lib/play/answer-events.ts` (`ANSWER_SOURCES`)
- Create: `drizzle/0042_*.sql` (generated, do not hand-write)
- Test: `tests/unit/review-sources.test.ts`

**Interfaces:**
- Produces: the string `'daily_review'` accepted by `awardCoins`, `awardXp`, `pullCardForChild`, and `logAnswerEventsSafe`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-sources.test.ts`:

```ts
// 'daily_review' has to be accepted by four separate unions before the feature
// can pay anything. Three are TS-only; coin_reason is a pgEnum and needs a
// migration.
import { describe, expect, it } from 'vitest';
import { ANSWER_SOURCES } from '@/lib/play/answer-events';

describe("the 'daily_review' source", () => {
  it('is a distinct answer source from the per-week flashcard section', () => {
    // ANSWER_SOURCES already contains 'review' — that is the per-week 回顾
    // section, NOT this feature. Reusing it would make the two
    // indistinguishable in answer_events and corrupt the exact signal A3
    // parent insights and V1 mastery will read back.
    expect(ANSWER_SOURCES).toContain('review');
    expect(ANSWER_SOURCES).toContain('daily_review');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/review-sources.test.ts`
Expected: FAIL — `ANSWER_SOURCES` does not contain `'daily_review'`.

- [ ] **Step 3: Add the value to all five places**

`src/lib/play/answer-events.ts`:
```ts
export const ANSWER_SOURCES = ['review', 'practice', 'boss', 'homework', 'study', 'daily_review'] as const;
```

`src/db/schema/economy.ts` — append to the `coinReason` pgEnum array (append only; never reorder an existing pgEnum):
```ts
  'key_vault',
  'daily_review',
]);
```

`src/lib/db/coins.ts` — append to `AwardCoinReason`:
```ts
  | 'key_vault'
  | 'daily_review';
```

`src/lib/db/xp.ts` — append `| 'daily_review'` to `XpSource`.

`src/lib/db/grants.ts` — append to `pullCardInTx`'s `source` parameter union:
```ts
  source: 'boss_clear' | 'perfect_week' | 'story_chapter' | 'review' | 'practice' | 'homework' | 'study' | 'bounty' | 'daily_review',
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Then: `cat drizzle/0042_*.sql`

Expected — exactly one statement:
```sql
ALTER TYPE "public"."coin_reason" ADD VALUE 'daily_review';
```

`ALTER TYPE … ADD VALUE` inside a migration transaction is already proven in this repo: migration 0033 did it for `trophy_category`. If drizzle emits anything else, stop and read the generated SQL before applying.

- [ ] **Step 5: Apply to the dev branch and verify the enum value is live**

Local `.env.local` points at the Neon **dev** branch, so this is safe. Confirm before running:

```bash
grep -oE 'ep-[a-z-]+[0-9]*' .env.local | head -1   # expect ep-dry-bird…
pnpm db:migrate
```

Then confirm the value actually exists:
```bash
pnpm tsx -e "
import { config } from 'dotenv'; config({ path: '.env.local' });
const { db } = await import('@/db'); const { sql } = await import('drizzle-orm');
const r = await db.execute(sql\`select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='coin_reason' and enumlabel='daily_review'\`);
console.log((r.rows ?? r).length === 1 ? 'daily_review present' : 'MISSING');
"
```

- [ ] **Step 6: Verify, then commit**

```bash
pnpm vitest run tests/unit/review-sources.test.ts
pnpm test && pnpm typecheck && pnpm lint
git add src/db/schema src/lib/db src/lib/play/answer-events.ts drizzle tests/unit/review-sources.test.ts
git commit -m "feat(review): 'daily_review' source across four unions (migration 0042)

ANSWER_SOURCES already contained 'review' — the per-week 回顾 section. The new
source is 'daily_review' precisely so the two stay distinguishable in
answer_events; collapsing them would corrupt the signal A3 and V1 read back."
```

---

## Task 4: Data layer

Reads the candidates and the cross-week pool in one go.

**Files:**
- Create: `src/lib/db/review.ts`
- Test: `tests/unit/review-db.test.ts`

**Interfaces:**
- Consumes: `ReviewCandidate` (Task 1); `ReviewPoolChar` (Task 2).
- Produces: `getReviewCandidates(childId: string): Promise<{ candidates: ReviewCandidate[]; pool: ReviewPoolChar[] }>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-db.test.ts`:

```ts
// The read behind 温故. Assertions here render the real WHERE fragments through
// PgDialect rather than trusting a pre-shaped mock return — a stub that answers
// with rows proves nothing about the query that asked for them, which is how a
// Critical shipped in the piggy-bank work.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: (...a: unknown[]) => mocks.select(...a) } }));

import { PgDialect } from 'drizzle-orm/pg-core';
import { getReviewCandidates } from '@/lib/db/review';

const dialect = new PgDialect();
const render = (frag: unknown) => dialect.sqlToQuery(frag as never);

/** Queue one resolved row-set per db.select(), capturing from()/where() args. */
function queueSelects(...rowSets: unknown[][]) {
  const calls: { from?: unknown; where?: unknown }[] = [];
  for (const rows of rowSets) {
    const rec: { from?: unknown; where?: unknown } = {};
    calls.push(rec);
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      from: vi.fn((t: unknown) => { rec.from = t; return chain; }),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      groupBy: vi.fn(() => Promise.resolve(rows)),
      limit: vi.fn(() => Promise.resolve(rows)),
      where: vi.fn((w: unknown) => { rec.where = w; return Promise.resolve(rows); }),
    });
    mocks.select.mockReturnValueOnce(chain);
  }
  return calls;
}

beforeEach(() => vi.clearAllMocks());

describe('getReviewCandidates', () => {
  it('restricts to weeks whose BOSS the child has cleared', async () => {
    // 温故 draws from what she has FINISHED. A week merely started is still
    // being taught; re-drilling it here would duplicate practice, not review.
    const calls = queueSelects([{ packId: 'pack-1' }], []);
    await getReviewCandidates('c1');
    const progressWhere = render(calls[1].where);
    expect(progressWhere.sql).toContain('"boss_cleared"');
    expect(progressWhere.params).toContain(true);
  });

  it('scopes every read to this child', async () => {
    const calls = queueSelects([{ packId: 'pack-1' }], []);
    await getReviewCandidates('c1');
    expect(render(calls[1].where).params).toContain('c1');
  });

  it('returns nothing when no week has been cleared', async () => {
    queueSelects([{ packId: 'pack-1' }], []);
    await expect(getReviewCandidates('c1')).resolves.toEqual({
      candidates: [],
      pool: [],
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/review-db.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db/review'`.

- [ ] **Step 3: Write the module**

Create `src/lib/db/review.ts`:

```ts
// A2 温故 — the read behind the daily review. SERVER-ONLY, and deliberately NOT
// under src/lib/actions/: every exported async function in a 'use server' file
// is a public RPC endpoint, and this one takes a raw childId.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  answerEvents,
  characterWord,
  characters,
  childProfiles,
  weekCharacters,
  weekProgress,
  weeks,
  words,
} from '@/db/schema';
import type { ReviewCandidate } from '@/lib/review/selection';
import type { ReviewPoolChar } from '@/lib/review/session';

/**
 * Characters from weeks the child has already CLEARED, with the telemetry
 * needed to rank them and the word data needed to build questions.
 *
 * Cleared, not merely playable: a week still being taught is covered by
 * practice, and re-drilling it here would duplicate that rather than review.
 */
export async function getReviewCandidates(childId: string): Promise<{
  candidates: ReviewCandidate[];
  pool: ReviewPoolChar[];
}> {
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  const packId = child?.packId ?? null;

  // Cleared weeks in the child's current pack (or their own authored weeks).
  const packCondition = packId
    ? sql`(${weeks.childId} = ${childId} OR (${weeks.childId} IS NULL AND ${weeks.curriculumPackId} = ${packId}))`
    : eq(weeks.childId, childId);

  const clearedWeeks = await db
    .select({ weekId: weeks.id, weekNumber: weeks.weekNumber })
    .from(weekProgress)
    .innerJoin(weeks, eq(weeks.id, weekProgress.weekId))
    .where(
      and(
        eq(weekProgress.childId, childId),
        eq(weekProgress.bossCleared, true),
        packCondition,
      ),
    );
  if (clearedWeeks.length === 0) return { candidates: [], pool: [] };

  const weekNumberById = new Map(clearedWeeks.map((w) => [w.weekId, w.weekNumber]));
  const weekIds = clearedWeeks.map((w) => w.weekId);

  // Characters in those weeks. A character keeps its HIGHEST week number, so a
  // char taught twice ranks by its most recent appearance.
  const charRows = await db
    .select({
      characterId: weekCharacters.characterId,
      weekId: weekCharacters.weekId,
      hanzi: characters.hanzi,
      meaningEn: characters.meaningEn,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(inArray(weekCharacters.weekId, weekIds));
  if (charRows.length === 0) return { candidates: [], pool: [] };

  const byChar = new Map<
    string,
    { hanzi: string; meaningEn: string | null; weekNumber: number }
  >();
  for (const r of charRows) {
    const wn = weekNumberById.get(r.weekId) ?? 0;
    const cur = byChar.get(r.characterId);
    if (!cur || wn > cur.weekNumber) {
      byChar.set(r.characterId, { hanzi: r.hanzi, meaningEn: r.meaningEn, weekNumber: wn });
    }
  }
  const charIds = Array.from(byChar.keys());

  // All-time telemetry per character, plus recency.
  //
  // LEFT JOIN semantics by construction: characters with no answer_events rows
  // simply have no stat row, and default to total 0 / null recency. That is
  // what NEUTRAL_WEAKNESS exists for — every character from a week cleared
  // before answer_events started (2026-07-03) is in exactly that position.
  const stats = await db
    .select({
      characterId: answerEvents.characterId,
      total: sql<number>`count(*)`,
      wrong: sql<number>`count(*) filter (where ${answerEvents.correct} = false)`,
      dontKnow: sql<number>`count(*) filter (where ${answerEvents.selfRating} in ('dont_know', 'not_sure'))`,
      daysSinceLastSeen: sql<
        number | null
      >`floor(extract(epoch from (now() - max(${answerEvents.createdAt}))) / 86400)`,
    })
    .from(answerEvents)
    .where(
      and(
        eq(answerEvents.childId, childId),
        inArray(answerEvents.characterId, charIds),
      ),
    )
    .groupBy(answerEvents.characterId);
  const statByChar = new Map(stats.map((s) => [s.characterId as string, s]));

  // Words for the pool — image_pick's stimulus and the cross-week ambiguity map.
  const wordRows = await db
    .select({
      characterId: characterWord.characterId,
      wordId: words.id,
      text: words.text,
      imageUrl: words.imageUrl,
    })
    .from(characterWord)
    .innerJoin(words, eq(words.id, characterWord.wordId))
    .where(inArray(characterWord.characterId, charIds));

  const wordsByChar = new Map<string, ReviewPoolChar['words']>();
  for (const w of wordRows) {
    const list = wordsByChar.get(w.characterId) ?? [];
    list.push({ wordId: w.wordId, text: w.text, imageUrl: w.imageUrl });
    wordsByChar.set(w.characterId, list);
  }

  const candidates: ReviewCandidate[] = charIds.map((id) => {
    const meta = byChar.get(id)!;
    const s = statByChar.get(id);
    return {
      characterId: id,
      hanzi: meta.hanzi,
      weekNumber: meta.weekNumber,
      total: Number(s?.total ?? 0),
      wrong: Number(s?.wrong ?? 0),
      dontKnow: Number(s?.dontKnow ?? 0),
      daysSinceLastSeen:
        s?.daysSinceLastSeen === null || s?.daysSinceLastSeen === undefined
          ? null
          : Number(s.daysSinceLastSeen),
    };
  });

  const pool: ReviewPoolChar[] = charIds.map((id) => {
    const meta = byChar.get(id)!;
    return {
      characterId: id,
      hanzi: meta.hanzi,
      meaningEn: meta.meaningEn,
      words: wordsByChar.get(id) ?? [],
    };
  });

  return { candidates, pool };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/review-db.test.ts`
Expected: PASS, 3 tests. If a mock chain does not satisfy a query shape, fix the HELPER — never weaken an assertion.

- [ ] **Step 5: Prove the boss-cleared filter is load-bearing**

Temporarily change `eq(weekProgress.bossCleared, true)` to `eq(weekProgress.bossCleared, false)`, run the test, confirm it FAILS, then restore. A filter no test can catch is the piggy-bank lesson repeating.

- [ ] **Step 6: Full suite, typecheck, lint, commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/db/review.ts tests/unit/review-db.test.ts
git commit -m "feat(review): candidate + pool read over answer_events

Cleared weeks only — a week still being taught is practice's job, and
re-drilling it here would duplicate rather than review.

Characters with no telemetry rows simply have no stat row and default to
total 0 / null recency, which is exactly what NEUTRAL_WEAKNESS is for: every
character from a week cleared before answer_events started (2026-07-03) is in
that position and must not be excluded."
```

---

## Task 5: The finish action

**Files:**
- Create: `src/lib/actions/review.ts`
- Test: `tests/unit/review-action.test.ts`

**Interfaces:**
- Consumes: `REVIEW_REWARD_COINS`, `REVIEW_REWARD_XP` (Task 1); `'daily_review'` unions (Task 3).
- Produces: `finishReviewAction(input): Promise<{ ok: true; cardGrants: RevealCard[]; cardMessage: ReviewCardMessage; coinsAwarded: number; xp: { gained: number; level: number; leveledUp: boolean } }>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  pullCardForChild: vi.fn(),
  awardCoins: vi.fn(),
  awardXp: vi.fn(),
  logAnswerEventsSafe: vi.fn(),
  tickQuestProgressSafe: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: mocks.awardCoins }));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: mocks.logAnswerEventsSafe }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: mocks.tickQuestProgressSafe }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-09-01' }));

import { finishReviewAction } from '@/lib/actions/review';

const GRANTED = {
  granted: true as const,
  itemId: 'i1',
  slug: 'rat',
  packSlug: 'zodiac-v1',
  nameZh: '鼠',
  nameEn: 'Rat',
  loreZh: null,
  loreEn: null,
  isDupe: false,
  shardsAfter: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' }, parent: { id: 'p1' } });
  mocks.pullCardForChild.mockResolvedValue(GRANTED);
  mocks.awardCoins.mockResolvedValue(undefined);
  mocks.awardXp.mockResolvedValue({ totalXp: 100, level: 3, leveledUp: false });
  mocks.logAnswerEventsSafe.mockResolvedValue(0);
});

describe('finishReviewAction', () => {
  it('gates on requireChild before any write', async () => {
    mocks.requireChild.mockRejectedValue(new Error('not yours'));
    await expect(finishReviewAction({ childId: 'other', score: 100 })).rejects.toThrow();
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('claims the card once per UTC day, globally', async () => {
    await finishReviewAction({ childId: 'c1', score: 100 });
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'daily_review', '2026-09-01');
  });

  it('pays coins and XP only on the granted branch', async () => {
    await finishReviewAction({ childId: 'c1', score: 100 });
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', delta: 40, reason: 'daily_review' }),
    );
    expect(mocks.awardXp).toHaveBeenCalledWith('c1', 15, 'daily_review', '2026-09-01');
  });

  it('pays NOTHING on a second run the same day', async () => {
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const res = await finishReviewAction({ childId: 'c1', score: 100 });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(mocks.awardXp).not.toHaveBeenCalled();
    expect(res.coinsAwarded).toBe(0);
  });

  it('pays the SAME whether she got 6/6 or 1/6', async () => {
    // Completing pays, not scoring. A review that punished wrong answers would
    // be a test, and this product deliberately does not test her — the same
    // reasoning behind boss_courage paying out on a FAILED boss.
    const perfect = await finishReviewAction({ childId: 'c1', score: 100 });
    vi.clearAllMocks();
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' }, parent: { id: 'p1' } });
    mocks.pullCardForChild.mockResolvedValue(GRANTED);
    mocks.awardXp.mockResolvedValue({ totalXp: 100, level: 3, leveledUp: false });
    const rough = await finishReviewAction({ childId: 'c1', score: 17 });
    expect(rough.coinsAwarded).toBe(perfect.coinsAwarded);
    expect(rough.xp.gained).toBe(perfect.xp.gained);
  });

  it("logs telemetry under 'daily_review', set server-side", async () => {
    await finishReviewAction({
      childId: 'c1',
      score: 50,
      // A client could claim any source; the action must ignore it.
      events: [{ sceneType: 'audio_pick', correct: true, source: 'boss' }],
    });
    expect(mocks.logAnswerEventsSafe).toHaveBeenCalledWith(
      'c1',
      null,
      'daily_review',
      expect.any(Array),
    );
  });

  it('still completes when the card grant throws', async () => {
    mocks.pullCardForChild.mockRejectedValue(new Error('db down'));
    await expect(finishReviewAction({ childId: 'c1', score: 100 })).resolves.toMatchObject({
      ok: true,
      coinsAwarded: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/review-action.test.ts`
Expected: FAIL — `Cannot find module '@/lib/actions/review'`.

- [ ] **Step 3: Write the action**

Create `src/lib/actions/review.ts`:

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { pullCardForChild } from '@/lib/play/card-grants';
import { awardCoins } from '@/lib/db/coins';
import { awardXp } from '@/lib/db/xp';
import { logAnswerEventsSafe } from '@/lib/db/answer-events';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import { todayUtcIso } from '@/lib/db/streaks';
import { MAX_EVENTS_PER_CALL } from '@/lib/play/answer-events';
import { REVIEW_REWARD_COINS, REVIEW_REWARD_XP } from '@/lib/review/selection';
import type { RevealCard } from '@/lib/play/reveal-card';

export type ReviewCardMessage = 'review_done_today' | 'daily_cap_reached' | null;

const FinishReviewSchema = z.object({
  childId: z.string().min(1),
  score: z.number().min(0).max(100),
  /** Per-answer telemetry — validated element-wise inside logAnswerEventsSafe. */
  events: z.array(z.unknown()).max(MAX_EVENTS_PER_CALL).optional(),
});

/**
 * Finish a 温故 session.
 *
 * The WHOLE reward fires only on `pullCardForChild`'s `granted` branch, so a
 * replay the same day grants nothing — the card-grant log row is the single
 * idempotency source, exactly as in finishStudyLessonAction and
 * finishHomeworkAction (`awardCoins` itself is not idempotent).
 *
 * **Completion pays, not score.** `score` is logged and returned for the
 * summary screen; no reward branches on it. A review that punished wrong
 * answers would be a test, and this product deliberately does not test her —
 * the same reasoning behind `boss_courage` paying out on a FAILED boss.
 */
export async function finishReviewAction(
  input: z.input<typeof FinishReviewSchema>,
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  cardMessage: ReviewCardMessage;
  coinsAwarded: number;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishReviewSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const dayUtc = todayUtcIso();

  // `source` and `childId` are set HERE, from the validated context — never
  // from the client, which could otherwise attribute events to any surface.
  // Positional signature: (childId, weekId, source, events). weekId is null —
  // a 温故 session spans weeks by definition and belongs to none of them.
  await logAnswerEventsSafe(child.id, null, 'daily_review', parsed.events ?? []);

  let card: RevealCard | null = null;
  let cardMessage: ReviewCardMessage = null;
  let coinsAwarded = 0;
  let xp = { gained: 0, level: 1, leveledUp: false };

  // Guarded: a reward failure must never reject the action. The runner awaits
  // it inside a transition with no catch.
  try {
    const res = await pullCardForChild(child.id, 'daily_review', dayUtc);
    if (res.granted) {
      await awardCoins({
        childId: child.id,
        delta: REVIEW_REWARD_COINS,
        reason: 'daily_review',
        refType: 'day',
        refId: dayUtc,
      });
      coinsAwarded = REVIEW_REWARD_COINS;

      const xpRes = await awardXp(child.id, REVIEW_REWARD_XP, 'daily_review', dayUtc);
      xp = { gained: REVIEW_REWARD_XP, level: xpRes.level, leveledUp: xpRes.leveledUp };

      void tickQuestProgressSafe(child.id, 'earn_card', 1);
      card = {
        id: res.itemId,
        slug: res.slug,
        packSlug: res.packSlug,
        nameZh: res.nameZh,
        nameEn: res.nameEn,
        loreZh: res.loreZh,
        loreEn: res.loreEn,
        isDupe: res.isDupe,
        shardsAfter: res.shardsAfter,
      };
    } else {
      cardMessage =
        res.reason === 'daily_cap_reached' ? 'daily_cap_reached' : 'review_done_today';
    }
  } catch (err) {
    console.error('[finishReviewAction] reward failed:', err);
  }

  revalidatePath(`/play/${child.id}`);
  return {
    ok: true,
    cardGrants: card ? [card] : [],
    cardMessage,
    coinsAwarded,
    xp,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm vitest run tests/unit/review-action.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Prove the score-independence test bites**

Temporarily gate the reward on `parsed.score >= 60`, run `-t "SAME whether"`, confirm FAIL, restore. That rule is a product decision, so it needs a test that actually defends it.

- [ ] **Step 6: Full suite, typecheck, lint, commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add src/lib/actions/review.ts tests/unit/review-action.test.ts
git commit -m "feat(review): finishReviewAction — completion pays, not score

The whole reward fires only on pullCardForChild's granted branch, so a replay
the same day grants nothing; the card-grant log row is the single idempotency
source, as in study and homework.

score is recorded and returned but no reward branches on it. A review that
punished wrong answers would be a test, and this product deliberately does not
test her — the same reasoning behind boss_courage paying out on a FAILED boss."
```

---

## Task 6: Runner and route

**Files:**
- Create: `src/components/play/ReviewRunner.tsx`
- Create: `src/app/play/[childId]/review/page.tsx`
- Test: `tests/unit/review-runner.test.tsx`

**Interfaces:**
- Consumes: `ReviewQuestion`, `ReviewPoolChar` (Task 2); `finishReviewAction` (Task 5); `getReviewCandidates` (Task 4).
- Produces: `ReviewRunner` (client) taking `{ childId, questions, pool }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-runner.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/review', () => ({ finishReviewAction: vi.fn() }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

import { ReviewRunner } from '@/components/play/ReviewRunner';
import { MidSceneProvider, useMidScene } from '@/components/play/MidSceneProvider';
import type { ReviewPoolChar, ReviewQuestion } from '@/lib/review/session';

const pool: ReviewPoolChar[] = [
  {
    characterId: 'c1',
    hanzi: '猫',
    meaningEn: 'cat',
    words: [{ wordId: 'w1', text: '小猫', imageUrl: 'http://x/cat.png' }],
  },
  { characterId: 'c2', hanzi: '狗', meaningEn: 'dog', words: [] },
  { characterId: 'c3', hanzi: '鸟', meaningEn: 'bird', words: [] },
  { characterId: 'c4', hanzi: '鱼', meaningEn: 'fish', words: [] },
];

const question = (over: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  id: 'translate_pick:c1:0',
  type: 'translate_pick',
  targetCharacterId: 'c1',
  stimulusWordId: null,
  choiceCharacterIds: ['c1', 'c2', 'c3', 'c4'],
  ...over,
});

describe('ReviewRunner', () => {
  it('renders the first question with four choices', () => {
    render(<ReviewRunner childId="c1" questions={[question()]} pool={pool} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });

  it('shows a bilingual prompt', () => {
    const { container } = render(
      <ReviewRunner childId="c1" questions={[question()]} pool={pool} />,
    );
    expect(container.textContent).toMatch(/[一-鿿]/);
    expect(container.textContent).toMatch(/[A-Za-z]/);
  });

  it('flips the mid-scene flag so a nav tap asks before abandoning the session', () => {
    // Documented landmine: any long-session route must mount MidSceneFlag, or
    // KidNavBar navigates away mid-session with no quit-confirm.
    //
    // MidSceneFlag renders null by design, so assert the BEHAVIOUR through the
    // real provider rather than adding a marker element to a shared component
    // for a test's convenience.
    function Probe() {
      const { midScene } = useMidScene();
      return <span data-testid="probe">{String(midScene)}</span>;
    }
    render(
      <MidSceneProvider>
        <ReviewRunner childId="c1" questions={[question()]} pool={pool} />
        <Probe />
      </MidSceneProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('true');
  });

  it('renders an audio_pick question without crashing', () => {
    render(
      <ReviewRunner
        childId="c1"
        questions={[question({ id: 'audio_pick:c1:0', type: 'audio_pick' })]}
        pool={pool}
      />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run tests/unit/review-runner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Do NOT modify `MidSceneProvider`**

`MidSceneFlag` returns `null` by design (its return type is literally `: null`). The test above asserts the behaviour through the real provider instead of adding a marker element to a shared component for a test's convenience. Leave `src/components/play/MidSceneProvider.tsx` untouched.

- [ ] **Step 4: Write the runner**

Create `src/components/play/ReviewRunner.tsx`, following `StudyRunner`'s shape exactly:

```tsx
'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';
import { MidSceneFlag } from '@/components/play/MidSceneProvider';
import { SpeakButton } from '@/components/play/SpeakButton';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { finishReviewAction } from '@/lib/actions/review';
import type { ReviewPoolChar, ReviewQuestion } from '@/lib/review/session';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

interface Props {
  childId: string;
  questions: ReviewQuestion[];
  pool: ReviewPoolChar[];
}

/**
 * Runs a 温故 session over the real MultipleChoiceQuiz, exactly as StudyRunner
 * does. Accumulates telemetry in a ref and submits ONCE at the end.
 */
export function ReviewRunner({ childId, questions, pool }: Props) {
  const router = useRouter();
  const byId = new Map(pool.map((c) => [c.characterId, c]));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [cards, setCards] = useState<RevealCard[]>([]);
  const [done, setDone] = useState(false);
  const events = useRef<SceneAnswerEvent[]>([]);
  const [, start] = useTransition();

  const q = questions[index];

  function onAnswer(isCorrect: boolean) {
    if (isCorrect) setCorrect((c) => c + 1);
    if (q) {
      // SceneAnswerEventSchema requires EXACTLY one of correct/selfRating.
      // 温故 never collects a self-rating, so `correct` is always the one set.
      events.current.push({
        sceneType: q.type,
        characterId: q.targetCharacterId,
        correct: isCorrect,
      });
    }

    const next = index + 1;
    if (next < questions.length) {
      setIndex(next);
      return;
    }

    const score = Math.round((((isCorrect ? correct + 1 : correct)) / questions.length) * 100);
    start(async () => {
      const res = await finishReviewAction({ childId, score, events: events.current });
      setCards(res.cardGrants);
      setDone(true);
    });
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-10">
        <h1 className="font-hanzi text-2xl font-extrabold">温故完成！</h1>
        <p className="italic text-[var(--color-sand-700)]">Review complete!</p>
        {cards.length > 0 ? (
          <CardChestReveal cards={cards} onDone={() => setCards([])} />
        ) : null}
        <WoodSignButton size="lg" onClick={() => router.push(`/play/${childId}`)}>
          回地图 / Back to the map
        </WoodSignButton>
      </main>
    );
  }

  if (!q) return null;

  const target = byId.get(q.targetCharacterId);
  if (!target) return null;

  const choices = q.choiceCharacterIds
    .map((id) => byId.get(id))
    .filter((c): c is ReviewPoolChar => Boolean(c));

  const progress = (
    <p className="text-xs text-[var(--color-sand-700)]">
      <span className="font-hanzi">温故</span>{' '}
      <span className="italic">/ Review</span> — {index + 1}/{questions.length}
    </p>
  );

  if (q.type === 'translate_pick') {
    return (
      <>
        <MidSceneFlag />
        {progress}
        <MultipleChoiceQuiz
          key={q.id}
          prompt={<span className="font-hanzi text-lg">这个字是什么意思？ / What does this mean?</span>}
          stimulus={<span className="font-hanzi text-6xl">{target.hanzi}</span>}
          choices={choices.map((c) => ({
            key: c.characterId,
            label: <span className="text-lg">{c.meaningEn}</span>,
            isCorrect: c.characterId === q.targetCharacterId,
          }))}
          postRevealAudio={target.hanzi}
          onComplete={onAnswer}
        />
      </>
    );
  }

  // audio_pick and image_pick both offer HANZI choices, so the stimulus must
  // not be the hanzi itself — speaking or showing it would give the answer.
  return (
    <>
      <MidSceneFlag />
      {progress}
      <MultipleChoiceQuiz
        key={q.id}
        prompt={<span className="font-hanzi text-lg">听音选字 / Listen and pick the character</span>}
        stimulus={<SpeakButton text={target.hanzi} size="md" label="🔊 听 / Listen" />}
        choices={choices.map((c) => ({
          key: c.characterId,
          label: <span className="font-hanzi text-4xl">{c.hanzi}</span>,
          isCorrect: c.characterId === q.targetCharacterId,
        }))}
        onComplete={onAnswer}
      />
    </>
  );
}
```

**`image_pick` must render its picture — do not punt it.** The runner above
handles `translate_pick` and `audio_pick`; add a third branch before the audio
fallback. The session builder already froze `stimulusWordId`, and the pool
carries every word's `imageUrl`, so no new data is needed:

```tsx
  if (q.type === 'image_pick') {
    const word = target.words.find((w) => w.wordId === q.stimulusWordId);
    // A frozen stimulus whose word vanished from the pool is not renderable;
    // fall through to the audio question rather than showing a blank box.
    if (word?.imageUrl) {
      return (
        <>
          <MidSceneFlag />
          {progress}
          <MultipleChoiceQuiz
            key={q.id}
            prompt={<span className="font-hanzi text-lg">看图找字 / Find the character</span>}
            stimulus={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={word.imageUrl}
                alt={word.text}
                className="h-40 w-40 rounded-2xl object-cover"
              />
            }
            choices={choices.map((c) => ({
              key: c.characterId,
              label: <span className="font-hanzi text-4xl">{c.hanzi}</span>,
              isCorrect: c.characterId === q.targetCharacterId,
            }))}
            onComplete={onAnswer}
          />
        </>
      );
    }
  }
```

Do NOT pass a hint: 💡 is practice-only, and the hint text describes the
picture in English, which would give the answer away here.

Add a test alongside the others in Task 6's file: an `image_pick` question whose
word has an `imageUrl` renders an `<img>`, and one whose `stimulusWordId` no
longer resolves falls back to the audio question rather than rendering a broken
image.

- [ ] **Step 5: Write the route**

Create `src/app/play/[childId]/review/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { ReviewRunner } from '@/components/play/ReviewRunner';
import { getReviewCandidates } from '@/lib/db/review';
import { pickReviewTargets, REVIEW_SESSION_SIZE } from '@/lib/review/selection';
import { buildReviewSession } from '@/lib/review/session';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function ReviewPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const { candidates, pool } = await getReviewCandidates(child.id);
  const targets = pickReviewTargets(candidates, REVIEW_SESSION_SIZE);
  const questions = buildReviewSession(targets, pool);

  // Not an error state — she simply has nothing to review yet. The home card
  // hides in the same case, so this is only reachable by a direct URL or a
  // race against it.
  if (questions.length === 0) redirect(`/play/${child.id}`);

  return <ReviewRunner childId={child.id} questions={questions} pool={pool} />;
}
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm vitest run tests/unit/review-runner.test.tsx
pnpm test && pnpm typecheck && pnpm lint && npx next build
git add src/components/play/ReviewRunner.tsx "src/app/play/[childId]/review" src/components/play/MidSceneProvider.tsx tests/unit/review-runner.test.tsx
git commit -m "feat(review): 温故 runner and route"
```

---

## Task 7: Home entry card

**Files:**
- Create: `src/components/play/DailyReviewCard.tsx`
- Modify: `src/app/play/[childId]/page.tsx`
- Test: `tests/unit/review-entry-card.test.tsx`

**Interfaces:**
- Consumes: `REVIEW_SESSION_SIZE` (Task 1); `getReviewCandidates` (Task 4).
- Produces: `DailyReviewCard` taking `{ childId; available: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-entry-card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyReviewCard } from '@/components/play/DailyReviewCard';

describe('DailyReviewCard', () => {
  it('links to the review route when there is enough to review', () => {
    render(<DailyReviewCard childId="c1" available />);
    expect(screen.getByTestId('daily-review-card')).toHaveAttribute(
      'href',
      '/play/c1/review',
    );
  });

  it('renders NOTHING when she has too little cleared material', () => {
    // A brand-new child, or one who has cleared no week. An entry point to an
    // empty session is worse than no entry point.
    const { container } = render(<DailyReviewCard childId="c1" available={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is bilingual', () => {
    render(<DailyReviewCard childId="c1" available />);
    const card = screen.getByTestId('daily-review-card');
    expect(card.textContent).toMatch(/温故/);
    expect(card.textContent).toMatch(/Review/i);
  });

  it('never frames the session as a test or a streak', () => {
    // 温故 gates nothing and must not acquire pressure. This product exists
    // partly to soften 畏难情绪 — a "don't break the chain" counter here would
    // re-add exactly what boss_courage and T3's reward-preview removed.
    render(<DailyReviewCard childId="c1" available />);
    const text = screen.getByTestId('daily-review-card').textContent ?? '';
    expect(text).not.toMatch(/连续|streak|考|test|day [0-9]/i);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `pnpm vitest run tests/unit/review-entry-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the card**

Create `src/components/play/DailyReviewCard.tsx`:

```tsx
import Link from 'next/link';

interface Props {
  childId: string;
  /** False when the child has fewer than REVIEW_SESSION_SIZE candidates. */
  available: boolean;
}

/**
 * Home entry to 温故. Hidden entirely when there is too little cleared
 * material — an entry point to an empty session is worse than none.
 *
 * Deliberately carries NO streak, day counter or score. 温故 gates nothing and
 * must not acquire pressure: this product softens 畏难情绪 elsewhere on purpose
 * (boss_courage pays on a failed boss; retries keep progress), and a
 * don't-break-the-chain counter here would undo that.
 */
export function DailyReviewCard({ childId, available }: Props) {
  if (!available) return null;

  return (
    <Link
      href={`/play/${childId}/review`}
      data-testid="daily-review-card"
      className="flex items-center justify-between rounded-2xl border-2 border-[var(--color-ocean-200)] bg-white/80 px-4 py-3 shadow-sm transition hover:border-[var(--color-ocean-300)]"
    >
      <span className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          📜
        </span>
        <span className="leading-tight">
          <span className="font-hanzi block font-bold text-[var(--color-ocean-900)]">
            温故
          </span>
          <span className="block text-[11px] italic text-[var(--color-sand-700)]">
            Review old friends
          </span>
        </span>
      </span>
      <span className="text-xs text-[var(--color-sand-600)]" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Mount it on the home page**

In `src/app/play/[childId]/page.tsx`, add to the existing `Promise.all` (never as a trailing serial await — this page already paid that cost once):

```ts
    getReviewCandidates(childId),
```

and destructure it in the SAME position as the array entry. Then compute and render after `<WantedPosters …/>`:

```tsx
      <DailyReviewCard
        childId={childId}
        available={
          pickReviewTargets(reviewData.candidates, REVIEW_SESSION_SIZE).length >=
          REVIEW_SESSION_SIZE
        }
      />
```

with imports for `DailyReviewCard`, `getReviewCandidates`, `pickReviewTargets`, `REVIEW_SESSION_SIZE`.

**Check the destructuring order against the array element by element.** A mismatch still typechecks whenever two adjacent types coincide, and would put the wrong data in the wrong variable on the home page of a children's game.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/review-entry-card.test.tsx
pnpm test && pnpm typecheck && pnpm lint && npx next build
git add src/components/play/DailyReviewCard.tsx "src/app/play/[childId]/page.tsx" tests/unit/review-entry-card.test.tsx
git commit -m "feat(review): home entry card for 温故

Hidden entirely below REVIEW_SESSION_SIZE candidates — an entry point to an
empty session is worse than none. Carries no streak or day counter: 温故 gates
nothing and must not acquire the pressure boss_courage and T3 exist to remove."
```

---

## Task 8: Documentation

**Files:**
- Modify: `CLAUDE.md` (snapshot, recent-changes window, landmines)
- Modify: `PLAN.md` (§1 shipped table)
- Modify: `docs/CHANGELOG.md` (narrative entry)
- Modify: `docs/IMPROVEMENT-ROADMAP.md` (mark A2 slice 2 done)

- [ ] **Step 1: Add the landmines**

Under **Play loop & scenes** in `CLAUDE.md`:

> **Landmine:** *温故's pool is cross-week BY DEFINITION, which reopens PR #158's ambiguity bug one week over.* `validStimulusWords` rejects a stimulus word shared with another character *in the pool distractors are drawn from*; for compiled practice that pool is one week, for 温故 it is every cleared week. `buildWordOwners` (`src/lib/review/session.ts`) therefore builds the owner map over the WHOLE review pool — build it per-week and the 唱歌 collision (唱 correct, 歌 offered as a distractor, no right answer) comes straight back. The guard's test was run against an unguarded builder and watched to fail before the guard was written; keep it that way.

> **Landmine:** *`'daily_review'` is NOT `'review'`.* `ANSWER_SOURCES` already contained `'review'` — the per-week 回顾 flashcard section. 温故 logs under `'daily_review'` precisely so the two stay distinguishable in `answer_events`; collapsing them would corrupt the exact signal A3 parent insights and V1 mastery are meant to read back. Same trap shape as the `zodiac` / `zodiac-v1` slug and the `getPackBySlug` namespace confusion: when you reuse a string key, check what already answers to it.

> **Landmine:** *温故 pays for COMPLETION, never for score, and gates nothing.* No reward branches on `score`; a review that punished wrong answers would be a test. Boss unlock still counts practice only, and nothing anywhere may require 温故 to have been played. The home card carries no streak or day counter — this product softens 畏难情绪 on purpose (`boss_courage` pays on a FAILED boss, `BossScene.reset()` keeps progress, T3 names rewards before the fight), and a don't-break-the-chain counter would undo all three.

- [ ] **Step 2: Update the snapshot and window**

Add a **温故 Daily review (A2)** paragraph after the bounties paragraph, refresh the "last refreshed" date and PR number, and roll the 3-PR recent-changes window (add this one, drop the oldest).

- [ ] **Step 3: PLAN.md, CHANGELOG.md, roadmap**

One row in `PLAN.md` §1. The full narrative in `docs/CHANGELOG.md`, including why `bountyScore` was rejected and how the cross-week guard was verified. In `docs/IMPROVEMENT-ROADMAP.md`, mark A2 slice 2 shipped and leave slice 1 (stale-char distractors in ordinary practice) open, noting it is cheaper than the roadmap assumed — four of five MCQ types sample distractors at runtime from a `pool` prop, so it needs no recompile, but it must re-derive the #158 guarantee across the widened pool.

- [ ] **Step 4: Commit**

```bash
pnpm test
git add CLAUDE.md PLAN.md docs/CHANGELOG.md docs/IMPROVEMENT-ROADMAP.md
git commit -m "docs(review): snapshot, landmines, changelog for 温故 (A2)"
```

---

## Post-merge operations

1. **Migration 0042** applies automatically on the Vercel production build (`tsx scripts/migrate.ts && next build`). It is a single `ALTER TYPE coin_reason ADD VALUE 'daily_review'`.
2. **No recompile.** Questions are built at request time — `week_levels` is untouched, so `recompile-all-weeks.ts` is NOT needed.
3. **No seed script**, no art generation, **no Blob operations**.
4. Optional sanity check once she has played one session: confirm `answer_events` has rows with `source = 'daily_review'` and that `coin_transactions` shows exactly one `daily_review` row for that UTC day.
