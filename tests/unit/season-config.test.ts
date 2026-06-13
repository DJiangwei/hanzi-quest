import { describe, expect, it } from 'vitest';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

describe('Summer Voyage config', () => {
  it('has 30 tiers numbered 1..30', () => {
    expect(SUMMER_VOYAGE_TIERS).toHaveLength(30);
    SUMMER_VOYAGE_TIERS.forEach((t, i) => expect(t.tier).toBe(i + 1));
  });

  it('xpRequired is strictly increasing (levels math depends on this)', () => {
    for (let i = 1; i < SUMMER_VOYAGE_TIERS.length; i++) {
      expect(SUMMER_VOYAGE_TIERS[i].xpRequired).toBeGreaterThan(
        SUMMER_VOYAGE_TIERS[i - 1].xpRequired,
      );
    }
  });

  it('references exactly 4 season cards and the grand-set trophy at tier 30', () => {
    const cards = SUMMER_VOYAGE_TIERS.filter((t) => t.reward.type === 'card');
    expect(cards).toHaveLength(4);
    const grand = SUMMER_VOYAGE_TIERS[29].reward;
    expect(grand.type).toBe('cosmetic_set');
    if (grand.type === 'cosmetic_set') {
      expect(grand.unlockRefs).toHaveLength(2);
      expect(grand.trophySlug).toBe('season-summer-master');
    }
  });
});
