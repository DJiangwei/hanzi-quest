import { describe, expect, it } from 'vitest';
import { TROPHIES } from '../../scripts/seed-trophies';

describe('season trophy seed', () => {
  it('includes season-summer-master in category season', () => {
    const t = TROPHIES.find((x) => x.slug === 'season-summer-master');
    expect(t).toBeDefined();
    expect(t?.category).toBe('season');
  });
});
