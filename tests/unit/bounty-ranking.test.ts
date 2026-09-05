// T2 通缉令 — pure selection engine.
import { describe, expect, it } from 'vitest';
import {
  BOUNTY_COUNT,
  bountyScore,
  pickBounties,
  type BountyCandidate,
} from '@/lib/bounty/ranking';

const cand = (over: Partial<BountyCandidate>): BountyCandidate => ({
  characterId: over.characterId ?? 'c-x',
  hanzi: over.hanzi ?? '字',
  weekNumber: over.weekNumber ?? 1,
  total: over.total ?? 0,
  // Defaults to "every row was a scored answer", which is what the older
  // fixtures meant before flashcard rows were split out.
  scored: over.scored ?? over.total ?? 0,
  wrong: over.wrong ?? 0,
  dontKnow: over.dontKnow ?? 0,
  ...over,
});

describe('bountyScore', () => {
  it('unseen chars outrank every weak char, later weeks first', () => {
    const unseenW9 = bountyScore(cand({ total: 0, weekNumber: 9 }));
    const unseenW2 = bountyScore(cand({ total: 0, weekNumber: 2 }));
    const veryWeak = bountyScore(cand({ total: 4, wrong: 4, weekNumber: 10 }));
    expect(unseenW9).toBeGreaterThan(unseenW2);
    expect(unseenW2).toBeGreaterThan(veryWeak);
  });

  it('weak scoring scales with miss rate; dont_know counts as a miss', () => {
    const halfWrong = bountyScore(cand({ total: 10, wrong: 5, weekNumber: 3 }));
    const rareWrong = bountyScore(cand({ total: 10, wrong: 1, weekNumber: 3 }));
    const selfRated = bountyScore(cand({ total: 10, wrong: 0, dontKnow: 5, weekNumber: 3 }));
    expect(halfWrong).toBeGreaterThan(rareWrong);
    // Both are genuinely weak, and dont_know still counts as a miss — but they
    // are no longer identical. `selfRated` has ten clean scored answers on top
    // of its five admissions, so its miss rate is 5/15, not 5/10.
    expect(selfRated).toBeGreaterThan(rareWrong);
    expect(selfRated).toBeLessThan(halfWrong);
  });

  it('does not treat a char met only through got_it flashcards as UNSEEN', () => {
    // The `total === 0` gate is the whole point of 通缉令: push her into weeks
    // she has never visited. A character she HAS met — even only on a flashcard
    // she tapped 认识 on — must not outrank every genuinely weak character.
    // This is why the fix below cannot simply swap `total` for `scored`.
    const flashcardedOnly = cand({ total: 5, scored: 0, wrong: 0, dontKnow: 0, weekNumber: 2 });
    const trulyUnseen = cand({ total: 0, weekNumber: 2 });
    expect(bountyScore(trulyUnseen)).toBe(100 + 2);
    expect(bountyScore(flashcardedOnly)).toBeLessThan(bountyScore(trulyUnseen));
  });

  it('weakness is not diluted by got_it flashcards', () => {
    // The same defect PR #167 fixed in 温故's reviewScore, still live here:
    // dividing misses by count(*) lets five tapped-through flashcards bury one
    // genuinely failed answer. 1 wrong out of 1 SCORED answer is a total miss
    // rate, however many flashcards sit alongside it.
    const drilledButFailing = cand({
      total: 6, // 5 got_it flashcards + 1 scored answer
      scored: 1,
      wrong: 1,
      weekNumber: 3,
    });
    expect(bountyScore(drilledButFailing)).toBe(60 + 3);
  });

  it('a practiced char with zero misses is never posted', () => {
    expect(bountyScore(cand({ total: 20, wrong: 0, dontKnow: 0 }))).toBe(0);
  });
});

describe('pickBounties', () => {
  const pool: BountyCandidate[] = [
    cand({ characterId: 'unseen-9', hanzi: '九', total: 0, weekNumber: 9 }),
    cand({ characterId: 'unseen-7', hanzi: '七', total: 0, weekNumber: 7 }),
    cand({ characterId: 'weak', hanzi: '难', total: 6, wrong: 3, weekNumber: 4 }),
    cand({ characterId: 'fine', hanzi: '好', total: 30, wrong: 0, weekNumber: 1 }),
  ];

  it('picks top 3 by score and never posts mastered chars', () => {
    const picked = pickBounties(pool, new Set());
    expect(picked.map((p) => p.characterId)).toEqual(['unseen-9', 'unseen-7', 'weak']);
    expect(picked).toHaveLength(BOUNTY_COUNT);
  });

  it('cooldown excludes recently posted chars', () => {
    const picked = pickBounties(pool, new Set(['unseen-9']));
    expect(picked.map((p) => p.characterId)).toEqual(['unseen-7', 'weak']);
  });

  it('returns fewer (or zero) posters when material runs out', () => {
    expect(pickBounties([cand({ characterId: 'fine2', total: 5 })], new Set())).toEqual([]);
  });

  it('is deterministic: full ties resolve the same way regardless of input order', () => {
    const a = cand({ characterId: 'a', hanzi: '乙', total: 0, weekNumber: 5 });
    const b = cand({ characterId: 'b', hanzi: '甲', total: 0, weekNumber: 5 });
    const picked1 = pickBounties([a, b], new Set(), 1);
    const picked2 = pickBounties([b, a], new Set(), 1);
    expect(picked1[0].characterId).toBe(picked2[0].characterId);
  });
});
