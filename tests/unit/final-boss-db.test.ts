import { describe, expect, it, vi } from 'vitest';

const playableWeeks = vi.fn();
const weekProgress = vi.fn();
vi.mock('@/lib/db/weeks', () => ({
  listChildPlayableWeeks: (...a: unknown[]) => playableWeeks(...a),
}));
vi.mock('@/lib/db/play', () => ({
  listProgressByChild: (...a: unknown[]) => weekProgress(...a),
}));
vi.mock('@/db', () => ({ db: {} }));

import { isMapFullyClearedFrom } from '@/lib/db/final-boss';

describe('isMapFullyClearedFrom (pure core)', () => {
  it('true only when every week of the pack is bossCleared', () => {
    const weeks = [
      { id: 'w1', curriculumPackId: 'p1' },
      { id: 'w2', curriculumPackId: 'p1' },
      { id: 'w3', curriculumPackId: 'p2' }, // other map — ignored
    ];
    const progress = [
      { weekId: 'w1', completionPercent: 100, bossCleared: true },
      { weekId: 'w2', completionPercent: 100, bossCleared: true },
    ];
    expect(isMapFullyClearedFrom('p1', weeks, progress)).toBe(true);
  });
  it('false when a week is missing its boss clear', () => {
    const weeks = [
      { id: 'w1', curriculumPackId: 'p1' },
      { id: 'w2', curriculumPackId: 'p1' },
    ];
    const progress = [{ weekId: 'w1', completionPercent: 100, bossCleared: true }];
    expect(isMapFullyClearedFrom('p1', weeks, progress)).toBe(false);
  });
  it('false when the pack has zero weeks', () => {
    expect(isMapFullyClearedFrom('p1', [], [])).toBe(false);
  });
});
