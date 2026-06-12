import { describe, expect, it } from 'vitest';
import { CONTINENT_ORDER } from '@/lib/collections/flagsData';
import {
  CONTINENT_REWARDS,
  TROPHY_TO_CONTINENT,
} from '@/lib/collections/continentRewards';

describe('CONTINENT_REWARDS', () => {
  it('has a reward entry for every continent', () => {
    for (const c of CONTINENT_ORDER) {
      expect(CONTINENT_REWARDS[c]).toBeDefined();
      expect(CONTINENT_REWARDS[c].trophySlug).toMatch(/^continent-/);
      expect(CONTINENT_REWARDS[c].avatarItemRef).toMatch(/^continent-/);
    }
  });

  it('trophy slugs are unique across continents', () => {
    const slugs = CONTINENT_ORDER.map((c) => CONTINENT_REWARDS[c].trophySlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('TROPHY_TO_CONTINENT round-trips every continent', () => {
    for (const c of CONTINENT_ORDER) {
      expect(TROPHY_TO_CONTINENT[CONTINENT_REWARDS[c].trophySlug]).toBe(c);
    }
  });
});
