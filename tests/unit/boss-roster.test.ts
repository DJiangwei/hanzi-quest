import { describe, expect, it } from 'vitest';
import { BOSS_ROSTER, getBossCreature } from '@/lib/scenes/boss-roster';

describe('boss roster', () => {
  it('has a non-empty roster, each entry well-formed', () => {
    expect(BOSS_ROSTER.length).toBeGreaterThan(0);
    for (const e of BOSS_ROSTER) {
      expect(e.key).toBeTruthy();
      expect(e.nameZh).toBeTruthy();
      expect(e.nameEn).toBeTruthy();
      expect(typeof e.Component).toBe('function');
    }
  });

  it('maps weekNumber to a creature, 1-based, with wraparound', () => {
    const n = BOSS_ROSTER.length;
    expect(getBossCreature(1)).toBe(BOSS_ROSTER[0]);
    expect(getBossCreature(n)).toBe(BOSS_ROSTER[n - 1]);
    expect(getBossCreature(n + 1)).toBe(BOSS_ROSTER[0]);
  });

  it('clamps non-positive weekNumber safely (no throw, valid entry)', () => {
    expect(BOSS_ROSTER).toContain(getBossCreature(0));
    expect(BOSS_ROSTER).toContain(getBossCreature(-3));
  });
});
