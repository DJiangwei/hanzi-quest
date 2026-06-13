import { describe, expect, it } from 'vitest';
import {
  defaultHeadForGender,
  DEFAULT_AVATAR,
  GENDER_DEFAULT_HEAD,
} from '@/lib/avatar/defaultLook';
import { defaultItems } from '@/lib/avatar/itemCatalog';

describe('defaultHeadForGender', () => {
  it('maps boy/girl to their gendered heads', () => {
    expect(defaultHeadForGender('boy')).toBe('default-kid-boy');
    expect(defaultHeadForGender('girl')).toBe('default-kid-girl');
    expect(GENDER_DEFAULT_HEAD.boy).toBe('default-kid-boy');
    expect(GENDER_DEFAULT_HEAD.girl).toBe('default-kid-girl');
  });

  it('falls back to the neutral default for null / unknown gender', () => {
    expect(defaultHeadForGender(null)).toBe(DEFAULT_AVATAR.head);
    expect(defaultHeadForGender(undefined)).toBe(DEFAULT_AVATAR.head);
    expect(defaultHeadForGender('other')).toBe(DEFAULT_AVATAR.head);
    expect(DEFAULT_AVATAR.head).toBe('default-kid-warm');
  });
});

describe('gendered head catalog items', () => {
  it('boy + girl heads are free defaults on the head slot', () => {
    const defaults = defaultItems();
    const boy = defaults.find((i) => i.unlockRef === 'default-kid-boy');
    const girl = defaults.find((i) => i.unlockRef === 'default-kid-girl');
    expect(boy).toBeDefined();
    expect(girl).toBeDefined();
    expect(boy?.slot).toBe('head');
    expect(girl?.slot).toBe('head');
    // free defaults — not sold, not reward-only
    for (const h of [boy, girl]) {
      expect(h?.priceCoins).toBeUndefined();
      expect(h?.rewardOnly).toBeUndefined();
    }
  });
});
