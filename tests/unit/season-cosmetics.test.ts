import { describe, expect, it } from 'vitest';
import { rewardItems } from '@/lib/avatar/itemCatalog';
import { SHOP_FILTER_THEMES, AVATAR_THEMES } from '@/lib/avatar/themes';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

describe('season cosmetics', () => {
  it("'season' is a theme but not a shop filter chip", () => {
    expect(AVATAR_THEMES).toContain('season');
    expect(SHOP_FILTER_THEMES).not.toContain('season');
  });

  it('every season cosmetic is rewardOnly + unpriced, 8 per season', () => {
    // Counted PER SEASON, not as one total. A magic grand total grows by 8
    // every season and tells whoever it breaks nothing about what it should
    // become; a per-season count says exactly which set is short.
    const season = rewardItems().filter((i) => i.theme === 'season');
    const bySeason = {
      summer: season.filter((i) => !i.unlockRef.startsWith('season-caspian-')),
      caspian: season.filter((i) => i.unlockRef.startsWith('season-caspian-')),
    };
    expect(bySeason.summer).toHaveLength(8);
    expect(bySeason.caspian).toHaveLength(8);
    expect(season).toHaveLength(bySeason.summer.length + bySeason.caspian.length);
    season.forEach((i) => {
      expect(i.rewardOnly).toBe(true);
      expect(i.priceCoins).toBeUndefined();
    });
  });

  it('every cosmetic unlockRef referenced by a tier exists in the catalog', () => {
    const refs = new Set(rewardItems().map((i) => i.unlockRef));
    for (const t of SUMMER_VOYAGE_TIERS) {
      if (t.reward.type === 'cosmetic') {
        expect(refs.has(t.reward.unlockRef)).toBe(true);
      }
      if (t.reward.type === 'cosmetic_set') {
        t.reward.unlockRefs.forEach((r) => expect(refs.has(r)).toBe(true));
      }
    }
  });
});
