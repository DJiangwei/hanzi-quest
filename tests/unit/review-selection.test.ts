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
