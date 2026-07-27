import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));

import { frontierWeekNumber, isWeekUnlockedFrom } from '@/lib/db/weeks';

/** Linear island gating (T3): playable up to and INCLUDING the frontier. */
describe('isWeekUnlockedFrom', () => {
  it('unlocks everything once every boss is beaten (frontier null)', () => {
    expect(isWeekUnlockedFrom(1, null)).toBe(true);
    expect(isWeekUnlockedFrom(10, null)).toBe(true);
  });

  it('unlocks the frontier itself', () => {
    expect(isWeekUnlockedFrom(4, 4)).toBe(true);
  });

  it('unlocks every already-beaten week behind the frontier (replay stays open)', () => {
    expect(isWeekUnlockedFrom(1, 4)).toBe(true);
    expect(isWeekUnlockedFrom(3, 4)).toBe(true);
  });

  it('locks everything past the frontier', () => {
    expect(isWeekUnlockedFrom(5, 4)).toBe(false);
    expect(isWeekUnlockedFrom(10, 4)).toBe(false);
  });

  it('locks all but week 1 for a child who has beaten nothing', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i + 1}`,
      weekNumber: i + 1,
    }));
    const frontier = frontierWeekNumber(weeks, new Set());
    expect(frontier).toBe(1);
    expect(weeks.filter((w) => isWeekUnlockedFrom(w.weekNumber, frontier))).toEqual([
      { id: 'w1', weekNumber: 1 },
    ]);
  });

  it('advances exactly one island per boss cleared', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i + 1}`,
      weekNumber: i + 1,
    }));
    const cleared = new Set(['w1', 'w2']);
    const frontier = frontierWeekNumber(weeks, cleared);
    expect(frontier).toBe(3);
    const unlocked = weeks.filter((w) => isWeekUnlockedFrom(w.weekNumber, frontier));
    expect(unlocked.map((w) => w.weekNumber)).toEqual([1, 2, 3]);
  });

  it('does not let an out-of-order clear open the islands AFTER it', () => {
    // Pre-existing save data: week 5 was beaten before the gate existed.
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i + 1}`,
      weekNumber: i + 1,
    }));
    const frontier = frontierWeekNumber(weeks, new Set(['w5']));
    expect(frontier).toBe(1);
    expect(isWeekUnlockedFrom(6, frontier, false)).toBe(false);
    expect(isWeekUnlockedFrom(7, frontier, false)).toBe(false);
  });

  it('never confiscates an island the child has already beaten', () => {
    // Same save as above: week 5 sits far past the frontier, but she earned it.
    expect(isWeekUnlockedFrom(5, 1, true)).toBe(true);
    expect(isWeekUnlockedFrom(9, 1, true)).toBe(true);
  });
});
