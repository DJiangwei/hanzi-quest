import { describe, expect, it } from 'vitest';
import { allItems } from '@/lib/avatar/itemCatalog';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR } from '@/lib/avatar/defaultLook';

describe('item catalog theme coverage (PR #58)', () => {
  it('every item has a theme field', () => {
    for (const item of allItems()) {
      expect(item.theme).toBeDefined();
      expect(['pirate', 'caribbean']).toContain(item.theme);
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
