// The 奖励衣橱's theme labels. One of these is a trap the next season walks into.
import { describe, expect, it } from 'vitest';
import {
  AVATAR_THEMES,
  THEME_DISPLAY_NAMES,
  type AvatarTheme,
} from '@/lib/avatar/themes';
import { SUMMER_VOYAGE_META } from '@/lib/season/summerVoyage';

describe('THEME_DISPLAY_NAMES', () => {
  it('labels every theme in both languages', () => {
    for (const t of AVATAR_THEMES) {
      const n = THEME_DISPLAY_NAMES[t as AvatarTheme];
      expect(n?.zh, `${t} zh`).toBeTruthy();
      expect(n?.en, `${t} en`).toBeTruthy();
    }
  });

  it('the season label names no PARTICULAR season', () => {
    // `season` is one generic avatar theme reused by every season's cosmetics,
    // so labelling it 夏季航海 / Summer Voyage meant season 2's rewards would
    // arrive in the wardrobe wearing season 1's name. The alternative — a new
    // avatar theme per season — needs an AVATAR_THEMES + REWARD_THEMES edit,
    // and keeping it out of SHOP_FILTER_THEMES, every season forever.
    const { zh, en } = THEME_DISPLAY_NAMES.season;
    expect(zh).not.toBe(SUMMER_VOYAGE_META.nameZh);
    expect(en).not.toBe(SUMMER_VOYAGE_META.nameEn);
    expect(zh).not.toMatch(/夏/);
    expect(en.toLowerCase()).not.toMatch(/summer|autumn|winter|spring/);
  });
});
