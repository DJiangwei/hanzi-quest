import { describe, expect, it } from 'vitest';
import {
  CHAMPIONS,
  CHAMPIONS_BY_SLUG,
  CHAMPION_TITLES,
  MAP_TO_CHAMPION_CARD,
} from '@/lib/collections/championsData';
import { getPackMeta } from '@/lib/collections/packRegistry';

describe('champions data', () => {
  it('has one bilingual card per supported map with a title', () => {
    expect(CHAMPIONS.length).toBeGreaterThanOrEqual(1);
    for (const c of CHAMPIONS) {
      expect(c.nameZh && c.nameEn && c.emoji).toBeTruthy();
    }
    // Caribbean map → its champion card + title exist.
    expect(MAP_TO_CHAMPION_CARD['pirate-class-level-1']).toBeTruthy();
    expect(CHAMPION_TITLES['pirate-class-level-1']?.zh).toBeTruthy();
    expect(CHAMPIONS_BY_SLUG[MAP_TO_CHAMPION_CARD['pirate-class-level-1']]).toBeTruthy();
  });
  it('registers champions-v1 with an ItemCard + reveal emoji', () => {
    const meta = getPackMeta('champions-v1');
    expect(meta).toBeTruthy();
    expect(meta!.ItemCard).toBeTypeOf('function');
    expect(meta!.resolveRevealEmoji).toBeTypeOf('function');
  });
});
