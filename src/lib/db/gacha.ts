import type { db } from '@/db';

// TEMPORARY — replaced when ./collections lands in Task 6
export type CollectibleItem = {
  id: string;
  packId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  rarity: 'common' | 'rare' | 'epic';
  dropWeight: number;
  imageUrl: string | null;
};

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PullResult {
  item: CollectibleItem;
  wasDuplicate: boolean;
  shardsAfter: number | null;
  coinsAfter: number;
}

export class InsufficientCoinsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient coins: need ${required}, have ${available}`);
    this.name = 'InsufficientCoinsError';
  }
}

export class AlreadyClaimedError extends Error {
  constructor() {
    super('Free pull already claimed for this week');
    this.name = 'AlreadyClaimedError';
  }
}

// pull / pullInTx come in Task 5.
