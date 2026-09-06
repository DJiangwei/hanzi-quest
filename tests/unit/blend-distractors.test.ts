// A2 slice 1 — stale-character distractors.
//
// Practice questions draw their wrong options from the week being taught. That
// makes every week an island: a character she learned in week 2 is never seen
// again once week 3 starts. Blending a previously-cleared character into each
// question is passive re-exposure at zero UI cost — GAME-DESIGN's own estimate
// is that it buys 80% of what a review system would.
//
// The ratio is the product decision: ONE older character per question, not a
// wholesale swap. Recognition has to happen under interference to be real, but
// this game deliberately softens 畏难情绪 and a question where three of four
// options are unfamiliar is a different, harder game than the one she agreed to.
import { describe, expect, it } from 'vitest';
import {
  blendDistractors,
  STALE_DISTRACTORS_PER_QUESTION,
  CONFUSABLE_DISTRACTORS_PER_QUESTION,
} from '@/lib/scenes/sample';

const week = ['w1', 'w2', 'w3', 'w4', 'w5'];
const older = ['o1', 'o2', 'o3', 'o4', 'o5'];

describe('blendDistractors', () => {
  it('takes exactly one from the older pool and the rest from this week', () => {
    const out = blendDistractors(week, older, 'w1', 3);
    expect(out).toHaveLength(3);
    expect(out.filter((c) => older.includes(c))).toHaveLength(
      STALE_DISTRACTORS_PER_QUESTION,
    );
    expect(out.filter((c) => week.includes(c))).toHaveLength(
      3 - STALE_DISTRACTORS_PER_QUESTION,
    );
  });

  it('never offers the target as its own distractor', () => {
    for (let i = 0; i < 50; i++) {
      expect(blendDistractors(week, older, 'w1', 3)).not.toContain('w1');
      expect(blendDistractors(week, older, 'o1', 3)).not.toContain('o1');
    }
  });

  it('returns distinct options', () => {
    for (let i = 0; i < 50; i++) {
      const out = blendDistractors(week, older, 'w1', 3);
      expect(new Set(out).size).toBe(out.length);
    }
  });

  it('falls back to this week alone when nothing has been cleared yet', () => {
    // Week 1 of map 1: there is no older pool, and the question must still
    // have three options. A child on her first week is exactly who cannot
    // afford a broken scene.
    const out = blendDistractors(week, [], 'w1', 3);
    expect(out).toHaveLength(3);
    expect(out.every((c) => week.includes(c))).toBe(true);
  });

  it('tops up from the older pool when the week is too small', () => {
    // An 8-character week where the target plus a shared-word exclusion leaves
    // fewer than two usable same-week options.
    const out = blendDistractors(['w1', 'w2'], older, 'w1', 3);
    expect(out).toHaveLength(3);
    expect(out).toContain('w2');
    expect(out.filter((c) => older.includes(c))).toHaveLength(2);
  });

  it('returns what it can rather than throwing when both pools are thin', () => {
    // Degrading to a 2-option question is bad; crashing mid-practice is worse.
    const out = blendDistractors(['w1', 'w2'], [], 'w1', 3);
    expect(out).toEqual(['w2']);
  });

  it('varies across calls, so the same older character is not glued to a week', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      for (const c of blendDistractors(week, older, 'w1', 3)) {
        if (older.includes(c)) seen.add(c);
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('honours an explicit older-count of zero', () => {
    // image_pick needs this: its stimulus word may be owned by a character in
    // the older pool, which would make the picture identify two answers.
    const out = blendDistractors(week, older, 'w1', 3, 0);
    expect(out.every((c) => week.includes(c))).toBe(true);
  });

  it('reserves one slot for a confusable option when one exists (V2 slice 1)', () => {
    // 82 of her 176 characters have a same-syllable neighbour, so this slot is
    // fillable often but not always — hence best-effort below.
    const out = blendDistractors(week, older, 'w1', 3, 1, undefined, {
      isConfusable: (c) => c === 'w4',
    });
    expect(out).toContain('w4');
    expect(out).toHaveLength(3);
    expect(out.filter((c) => older.includes(c))).toHaveLength(
      STALE_DISTRACTORS_PER_QUESTION,
    );
  });

  it('takes only ONE confusable option, never a whole set of them', () => {
    // Three hard options out of four is a different, harder game than the one
    // she agreed to play; this product softens 畏难情绪 deliberately.
    //
    // Observing "only one" needs the confusable candidates to be unreachable
    // by the RANDOM fill, or a coincidence looks like a stacked question. With
    // fromOlder = 0 and every older item marked confusable, an older item in
    // the output can only have arrived through the confusable slot — so its
    // count IS the slot's width. (The first draft asserted one older item with
    // fromOlder = 1 and an all-matching predicate, which is a different claim
    // the code never made: the confusable slot draws from EITHER pool.)
    expect(CONFUSABLE_DISTRACTORS_PER_QUESTION).toBe(1);
    for (let i = 0; i < 40; i++) {
      const out = blendDistractors(week, older, 'w1', 3, 0, undefined, {
        isConfusable: (c) => older.includes(c),
      });
      expect(out).toHaveLength(3);
      expect(out.filter((c) => older.includes(c))).toHaveLength(1);
    }
  });

  it('falls back to the ordinary question when nothing is confusable', () => {
    // Most characters have no neighbour. A question without one is the
    // pre-V2 question, not a broken one.
    const out = blendDistractors(week, older, 'w1', 3, 1, undefined, {
      isConfusable: () => false,
    });
    expect(out).toHaveLength(3);
    expect(out).not.toContain('w1');
    expect(new Set(out).size).toBe(3);
  });

  it('never lets the confusable slot duplicate an already-picked option', () => {
    for (let i = 0; i < 40; i++) {
      const out = blendDistractors(week, older, 'w1', 3, 1, undefined, {
        isConfusable: (c) => older.includes(c),
      });
      expect(new Set(out).size).toBe(out.length);
    }
  });
});
