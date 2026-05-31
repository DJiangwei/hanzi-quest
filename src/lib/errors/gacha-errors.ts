// Pure error classes for the gacha flow.
//
// Lives outside of @/lib/db/gacha (which imports the postgres client and
// therefore can't be loaded into the browser bundle) and outside of
// @/lib/actions/gacha (which is marked 'use server' and can only export
// async functions). Client components throw/catch these alongside the
// server actions they call.

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

export class WeeklyCapReachedError extends Error {
  constructor(
    public readonly childId: string,
    public readonly cap: number,
    public readonly cardsThisWeek: number,
  ) {
    super(`Child ${childId} reached the weekly card cap (${cardsThisWeek}/${cap})`);
    this.name = 'WeeklyCapReachedError';
  }
}

export class InsufficientShardsError extends Error {
  constructor(
    public readonly childId: string,
    public readonly packId: string,
    public readonly needed: number,
    public readonly have: number,
  ) {
    super(`Child ${childId} has ${have} shards for pack ${packId}; needs ${needed}`);
    this.name = 'InsufficientShardsError';
  }
}

export class CardGrantAlreadyExistsError extends Error {
  constructor(
    public readonly childId: string,
    public readonly source: string,
    public readonly refId: string,
  ) {
    super(`Card grant already recorded for (${childId}, ${source}, ${refId})`);
    this.name = 'CardGrantAlreadyExistsError';
  }
}
