import type { Continent } from './flagsData';
import { CONTINENT_ORDER } from './flagsData';

/**
 * Reward mapping for completing a whole continent's flags. Pure + client-safe.
 *   trophySlug    — the trophy granted (seeded in scripts/seed-trophies.ts).
 *   avatarItemRef — the reward-only avatar cosmetic (PR-B; granted alongside the
 *                   trophy once the cosmetics are seeded).
 */
export interface ContinentReward {
  trophySlug: string;
  avatarItemRef: string;
}

export const CONTINENT_REWARDS: Record<Continent, ContinentReward> = {
  asia: { trophySlug: 'continent-asia', avatarItemRef: 'continent-asia' },
  europe: { trophySlug: 'continent-europe', avatarItemRef: 'continent-europe' },
  africa: { trophySlug: 'continent-africa', avatarItemRef: 'continent-africa' },
  north_america: {
    trophySlug: 'continent-north-america',
    avatarItemRef: 'continent-north-america',
  },
  south_america: {
    trophySlug: 'continent-south-america',
    avatarItemRef: 'continent-south-america',
  },
  oceania: { trophySlug: 'continent-oceania', avatarItemRef: 'continent-oceania' },
};

/** Reverse map: trophy slug → continent (for resolving a granted trophy). */
export const TROPHY_TO_CONTINENT: Record<string, Continent> = Object.fromEntries(
  CONTINENT_ORDER.map((c) => [CONTINENT_REWARDS[c].trophySlug, c]),
) as Record<string, Continent>;
