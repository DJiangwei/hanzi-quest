export class MapLockedError extends Error {
  reason: 'no_weeks' | 'gated';
  constructor(reason: 'no_weeks' | 'gated' = 'no_weeks') {
    super(
      reason === 'gated'
        ? 'Defeat the previous overlord first'
        : 'Map has no weeks yet',
    );
    this.name = 'MapLockedError';
    this.reason = reason;
  }
}
