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
  scored: over.scored ?? 0,
  wrong: over.wrong ?? 0,
  dontKnow: over.dontKnow ?? 0,
  daysSinceLastSeen: over.daysSinceLastSeen ?? null,
  ...over,
});

describe('reviewScore', () => {
  it('scores a character she keeps missing above one she always gets right', () => {
    const weak = reviewScore(cand({ scored: 10, wrong: 8, daysSinceLastSeen: 5 }));
    const solid = reviewScore(cand({ scored: 10, wrong: 0, daysSinceLastSeen: 5 }));
    expect(weak).toBeGreaterThan(solid);
  });

  it('counts a "don\'t know" self-rating as a miss', () => {
    const rated = reviewScore(cand({ scored: 10, dontKnow: 8, daysSinceLastSeen: 5 }));
    const clean = reviewScore(cand({ scored: 10, daysSinceLastSeen: 5 }));
    expect(rated).toBeGreaterThan(clean);
  });

  it('raises the score the longer a character has gone unseen', () => {
    const stale = reviewScore(cand({ scored: 10, wrong: 2, daysSinceLastSeen: 20 }));
    const fresh = reviewScore(cand({ scored: 10, wrong: 2, daysSinceLastSeen: 1 }));
    expect(stale).toBeGreaterThan(fresh);
  });

  it('caps staleness so an ancient character cannot dominate forever', () => {
    const old = reviewScore(cand({ scored: 10, wrong: 2, daysSinceLastSeen: STALE_CAP }));
    const ancient = reviewScore(cand({ scored: 10, wrong: 2, daysSinceLastSeen: 9999 }));
    expect(ancient).toBe(old);
  });

  it('gives an untelemetered character a NEUTRAL weakness, not a maximal one', () => {
    // THE anti-bountyScore assertion. answer_events only started 2026-07-03,
    // so every character from a week cleared before that has scored === 0
    // despite being thoroughly learned. bountyScore ranks those above every
    // weak character (`total === 0 → 100 + weekNumber`) because bounties push
    // her into UNVISITED weeks. Review targets the opposite population, so
    // reusing that scorer would let pre-telemetry characters crowd out
    // genuinely weak ones indefinitely.
    const unseen = reviewScore(cand({ scored: 0, daysSinceLastSeen: null }));
    const veryWeak = reviewScore(cand({ scored: 10, wrong: 10, daysSinceLastSeen: 5 }));
    expect(unseen).toBeLessThan(veryWeak);
    expect(unseen).toBeGreaterThan(reviewScore(cand({ scored: 10, wrong: 0, daysSinceLastSeen: 5 })));
  });

  it('treats a never-seen character as moderately stale rather than infinitely so', () => {
    const nullSeen = reviewScore(cand({ scored: 0, daysSinceLastSeen: null }));
    expect(nullSeen).toBe(NEUTRAL_WEAKNESS + 14);
  });

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
});

describe('pickReviewTargets', () => {
  it('returns the highest-scoring characters, most urgent first', () => {
    const picked = pickReviewTargets(
      [
        cand({ characterId: 'a', scored: 10, wrong: 0, daysSinceLastSeen: 1 }),
        cand({ characterId: 'b', scored: 10, wrong: 9, daysSinceLastSeen: 25 }),
        cand({ characterId: 'c', scored: 10, wrong: 5, daysSinceLastSeen: 10 }),
      ],
      2,
    );
    expect(picked.map((p) => p.characterId)).toEqual(['b', 'c']);
  });

  it('is deterministic — ties break by later week, then hanzi', () => {
    const a = cand({ characterId: 'a', hanzi: '安', weekNumber: 2, scored: 4, wrong: 2, daysSinceLastSeen: 3 });
    const b = cand({ characterId: 'b', hanzi: '本', weekNumber: 5, scored: 4, wrong: 2, daysSinceLastSeen: 3 });
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
