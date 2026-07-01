import { describe, expect, it } from 'vitest';
import { TROPHIES } from '../../scripts/seed-trophies';
import { MAP_TO_CHAMPION_TROPHY } from '@/lib/db/trophies';

describe('champion trophy', () => {
  it('the caribbean champion trophy is seeded in the champion category', () => {
    const slug = MAP_TO_CHAMPION_TROPHY['pirate-class-level-1'];
    expect(slug).toBeTruthy();
    const t = TROPHIES.find((x) => x.slug === slug);
    expect(t).toBeTruthy();
    expect(t!.category).toBe('champion');
  });
});
