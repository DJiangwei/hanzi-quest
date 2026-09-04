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
