import type { SeasonTier } from './types';

/**
 * Highest tier whose cumulative `xpRequired` ≤ `xp`; 0 when below tier 1.
 * Assumes `tiers` is sorted ascending by `xpRequired` (the config guarantees it).
 */
export function tierForSeasonXp(xp: number, tiers: SeasonTier[]): number {
  let reached = 0;
  for (const t of tiers) {
    if (xp >= t.xpRequired) reached = t.tier;
    else break;
  }
  return reached;
}

/** XP remaining to the next unreached tier; null when every tier is reached. */
export function xpToNextTier(xp: number, tiers: SeasonTier[]): number | null {
  for (const t of tiers) {
    if (xp < t.xpRequired) return t.xpRequired - xp;
  }
  return null;
}

/** Reached tiers (by xp) that are not yet in `claimed`. Sorted ascending. */
export function claimableTiers(
  xp: number,
  claimed: number[],
  tiers: SeasonTier[],
): number[] {
  const claimedSet = new Set(claimed);
  return tiers
    .filter((t) => xp >= t.xpRequired && !claimedSet.has(t.tier))
    .map((t) => t.tier);
}
