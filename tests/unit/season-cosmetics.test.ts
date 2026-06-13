import { describe, expect, it } from 'vitest';
import { rewardItems } from '@/lib/avatar/itemCatalog';
import { SHOP_FILTER_THEMES, AVATAR_THEMES } from '@/lib/avatar/themes';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

describe('season cosmetics', () => {
  it("'season' is a theme but not a shop filter chip", () => {
    expect(AVATAR_THEMES).toContain('season');
    expect(SHOP_FILTER_THEMES).not.toContain('season');
  });

  it('rewardItems() includes all 8 season cosmetics, all rewardOnly + unpriced', () => {
    const season = rewardItems().filter((i) => i.theme === 'season');
    expect(season).toHaveLength(8);
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
