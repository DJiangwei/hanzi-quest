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
  /**
   * 存钱罐: real pocket money paid ON TOP of `reward`, in pence.
   *
   * Deliberately not a `{ type: 'money' }` variant of SeasonReward — that union
   * is one-reward-per-tier, so a money variant would REPLACE this tier's card
   * or cosmetic instead of adding to it.
   */
  bonusMoneyPence?: number;
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
