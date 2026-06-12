import { describe, expect, it } from 'vitest';
import {
  rewardItems,
  defaultItems,
  shopItemsCatalog,
  lookupItem,
} from '@/lib/avatar/itemCatalog';
import { FESTIVAL_THEMES } from '@/lib/calendar/festivals';

describe('festival avatar cosmetics', () => {
  it('rewardItems() are reward-only + unpriced: 12 festival + 6 continent', () => {
    const items = rewardItems();
    for (const i of items) {
      expect(i.rewardOnly).toBe(true);
      expect(i.priceCoins).toBeUndefined();
      expect(['hat', 'decor']).toContain(i.slot);
    }
    expect(items.filter((i) => i.theme === 'festival')).toHaveLength(12);
    expect(items.filter((i) => i.theme === 'continent')).toHaveLength(6);
  });

  it('reward items are excluded from defaults and from the shop catalog', () => {
    const defaultRefs = new Set(defaultItems().map((i) => i.unlockRef));
    const shopRefs = new Set(shopItemsCatalog().map((i) => i.unlockRef));
    for (const i of rewardItems()) {
      expect(defaultRefs.has(i.unlockRef)).toBe(false);
      expect(shopRefs.has(i.unlockRef)).toBe(false);
    }
  });

  it('every month theme maps to a real, reward-only festival cosmetic', () => {
    const refs = new Set<string>();
    for (let m = 1; m <= 12; m++) {
      const ref = FESTIVAL_THEMES[m].avatarItemRef;
      refs.add(ref);
      const item = lookupItem(ref);
      expect(item, `missing catalog item for ${ref}`).toBeDefined();
      expect(item?.rewardOnly).toBe(true);
      expect(item?.theme).toBe('festival');
    }
    // 12 distinct cosmetics, one per month.
    expect(refs.size).toBe(12);
  });
});
