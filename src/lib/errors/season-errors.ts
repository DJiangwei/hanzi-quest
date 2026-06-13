/** Pure, client-safe error classes for the Season Pass (no postgres imports). */

export class NoActiveSeasonError extends Error {
  constructor() {
    super('No active season');
    this.name = 'NoActiveSeasonError';
  }
}

export class TierNotReachedError extends Error {
  constructor(public tier: number) {
    super(`Tier ${tier} not reached`);
    this.name = 'TierNotReachedError';
  }
}
