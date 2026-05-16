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
