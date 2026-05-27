export class MapLockedError extends Error {
  constructor() {
    super('Map is locked (zero published weeks)');
    this.name = 'MapLockedError';
  }
}
