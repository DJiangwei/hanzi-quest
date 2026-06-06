import { describe, expect, it } from 'vitest';
import { levelForXp, titleForLevel, xpForLevel } from '@/lib/xp/levels';

describe('xp levels', () => {
  it('xpForLevel follows the curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(3)).toBe(150);
    expect(xpForLevel(4)).toBe(300);
    expect(xpForLevel(5)).toBe(500);
  });
  it('levelForXp inverts the curve (highest level whose threshold ≤ xp)', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(149)).toBe(2);
    expect(levelForXp(300)).toBe(4);
    expect(levelForXp(10_000)).toBeGreaterThanOrEqual(15);
  });
  it('titleForLevel maps bands bilingually', () => {
    expect(titleForLevel(1).zh).toBe('见习水手');
    expect(titleForLevel(6).en).toBe('First Mate');
    expect(titleForLevel(20).zh).toBe('海洋大师');
  });
});
