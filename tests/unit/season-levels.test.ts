import { describe, expect, it } from 'vitest';
import { tierForSeasonXp, xpToNextTier, claimableTiers } from '@/lib/season/levels';
import type { SeasonTier } from '@/lib/season/types';

const tiers: SeasonTier[] = [
  { tier: 1, xpRequired: 50, reward: { type: 'coins', amount: 100 } },
  { tier: 2, xpRequired: 100, reward: { type: 'coins', amount: 50 } },
  { tier: 3, xpRequired: 175, reward: { type: 'coins', amount: 50 } },
];

describe('season levels', () => {
  it('tierForSeasonXp returns the highest tier whose xpRequired <= xp (0 below tier 1)', () => {
    expect(tierForSeasonXp(0, tiers)).toBe(0);
    expect(tierForSeasonXp(49, tiers)).toBe(0);
    expect(tierForSeasonXp(50, tiers)).toBe(1);
    expect(tierForSeasonXp(120, tiers)).toBe(2);
    expect(tierForSeasonXp(9999, tiers)).toBe(3);
  });

  it('xpToNextTier returns XP remaining to the next unreached tier, or null at max', () => {
    expect(xpToNextTier(0, tiers)).toBe(50);
    expect(xpToNextTier(60, tiers)).toBe(40); // → tier 2 at 100
    expect(xpToNextTier(175, tiers)).toBeNull(); // all reached
  });

  it('claimableTiers = reached tiers not in tiersClaimed', () => {
    expect(claimableTiers(120, [], tiers)).toEqual([1, 2]);
    expect(claimableTiers(120, [1], tiers)).toEqual([2]);
    expect(claimableTiers(49, [], tiers)).toEqual([]);
  });
});
