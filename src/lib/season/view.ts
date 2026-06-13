import type { SeasonRow } from './types';
import { tierForSeasonXp, xpToNextTier } from './levels';

export interface SeasonViewTier {
  tier: number;
  xpRequired: number;
  reward: SeasonRow['tierConfig'][number]['reward'];
  state: 'locked' | 'claimable' | 'claimed';
}

export interface SeasonView {
  id: string;
  nameZh: string;
  nameEn: string;
  themeEmoji: string;
  seasonXp: number;
  currentTier: number;
  xpToNext: number | null;
  daysRemaining: number;
  ended: boolean;
  tiers: SeasonViewTier[];
}

const DAY_MS = 86_400_000;

/** Pure assembly of the season view from a season row + derived XP + claim set. */
export function assembleSeasonView(
  season: SeasonRow,
  xp: number,
  claimed: number[],
  nowMs: number,
): SeasonView {
  const claimedSet = new Set(claimed);
  const currentTier = tierForSeasonXp(xp, season.tierConfig);
  const ended = nowMs > season.endsAt.getTime();
  const daysRemaining = ended
    ? 0
    : Math.max(0, Math.ceil((season.endsAt.getTime() - nowMs) / DAY_MS));
  const tiers: SeasonViewTier[] = season.tierConfig.map((t) => ({
    tier: t.tier,
    xpRequired: t.xpRequired,
    reward: t.reward,
    state: claimedSet.has(t.tier)
      ? 'claimed'
      : xp >= t.xpRequired
        ? 'claimable'
        : 'locked',
  }));
  return {
    id: season.id,
    nameZh: season.nameZh,
    nameEn: season.nameEn,
    themeEmoji: season.themeEmoji,
    seasonXp: xp,
    currentTier,
    xpToNext: xpToNextTier(xp, season.tierConfig),
    daysRemaining,
    ended,
    tiers,
  };
}
