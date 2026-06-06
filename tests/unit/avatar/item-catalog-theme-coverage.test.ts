import { describe, expect, it } from 'vitest';
import { allItems } from '@/lib/avatar/itemCatalog';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR } from '@/lib/avatar/defaultLook';
import { AVATAR_THEMES } from '@/lib/avatar/themes';

describe('item catalog theme coverage (PR #58)', () => {
  it('every item has a valid theme field', () => {
    for (const item of allItems()) {
      expect(item.theme).toBeDefined();
      expect(AVATAR_THEMES).toContain(item.theme);
    }
  });

  it('space + unicorn each have 11 items (new themes)', () => {
    const items = allItems();
    expect(items.filter((i) => i.theme === 'space')).toHaveLength(11);
    expect(items.filter((i) => i.theme === 'unicorn')).toHaveLength(11);
  });

  it('space + unicorn each cover all 7 slots', () => {
    const items = allItems();
    for (const theme of ['space', 'unicorn'] as const) {
      for (const slot of AVATAR_SLOT_IDS) {
        const found = items.find((i) => i.slot === slot && i.theme === theme);
        expect(found, `theme=${theme} slot=${slot} missing`).toBeDefined();
      }
    }
  });

  it('every shop item has a rarity + price; every renderSvg returns an element', () => {
    for (const item of allItems()) {
      if (item.priceCoins !== undefined) expect(item.rarity).toBeDefined();
      expect(item.renderSvg()).toBeTruthy();
    }
  });

  it('DEFAULT_AVATAR references existing catalog items', () => {
    for (const [slot, unlockRef] of Object.entries(DEFAULT_AVATAR)) {
      const item = allItems().find((i) => i.unlockRef === unlockRef);
      expect(item, `default for slot ${slot} = ${unlockRef}`).toBeDefined();
    }
  });

  it('decor is not in DEFAULT_AVATAR (intentional)', () => {
    expect((DEFAULT_AVATAR as Record<string, string>).decor).toBeUndefined();
  });

  it('every slot has at least 1 pirate item', () => {
    const items = allItems();
    for (const slot of AVATAR_SLOT_IDS) {
      const found = items.find((i) => i.slot === slot && i.theme === 'pirate');
      expect(found, `slot=${slot} has no pirate item`).toBeDefined();
    }
  });

  it('every slot has at least 1 caribbean item', () => {
    const items = allItems();
    for (const slot of AVATAR_SLOT_IDS) {
      const found = items.find((i) => i.slot === slot && i.theme === 'caribbean');
      expect(found, `slot=${slot} has no caribbean item`).toBeDefined();
    }
  });
});
