export type SeasonReward =
  | { type: 'coins'; amount: number }
  | { type: 'powerup'; kind: 'skip' | 'streak_freeze'; count: number }
  | { type: 'shards'; amount: number }
  | { type: 'card'; cardSlug: string } // resolved within the season-summer-v1 pack
  | { type: 'cosmetic'; unlockRef: string } // avatar_items.unlock_ref
  | { type: 'cosmetic_set'; unlockRefs: string[]; trophySlug: string };

export interface SeasonTier {
  /** 1..30 */
  tier: number;
  /** Cumulative season XP required to reach this tier. */
  xpRequired: number;
  reward: SeasonReward;
}

export interface SeasonRow {
  id: string;
  nameZh: string;
  nameEn: string;
  themeEmoji: string;
  startsAt: Date;
  endsAt: Date;
  tierConfig: SeasonTier[];
  isActive: boolean;
}
