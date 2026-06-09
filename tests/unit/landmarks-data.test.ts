import { describe, expect, it } from 'vitest';
import { LANDMARKS, LANDMARKS_BY_SLUG } from '@/lib/collections/landmarksData';
import { CONTINENT_ORDER } from '@/lib/collections/flagsData';

describe('landmarksData', () => {
  it('has a healthy roster (>= 15 landmarks)', () => {
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(15);
  });

  it('every entry has bilingual name, location, and lore + an emoji', () => {
    for (const l of LANDMARKS) {
      expect(l.nameZh, `${l.slug} nameZh`).toBeTruthy();
      expect(l.nameEn, `${l.slug} nameEn`).toBeTruthy();
      expect(l.locationZh, `${l.slug} locationZh`).toBeTruthy();
      expect(l.locationEn, `${l.slug} locationEn`).toBeTruthy();
      expect(l.loreZh, `${l.slug} loreZh`).toBeTruthy();
      expect(l.loreEn, `${l.slug} loreEn`).toBeTruthy();
      expect(l.emoji, `${l.slug} emoji`).toBeTruthy();
    }
  });

  it('every entry has a valid continent in CONTINENT_ORDER', () => {
    for (const l of LANDMARKS) {
      expect(CONTINENT_ORDER, `${l.slug} continent`).toContain(l.continent);
    }
  });

  it('every continent has at least one landmark', () => {
    for (const c of CONTINENT_ORDER) {
      expect(
        LANDMARKS.some((l) => l.continent === c),
        `continent ${c} is empty`,
      ).toBe(true);
    }
  });

  it('slugs are unique', () => {
    const slugs = LANDMARKS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('dropWeight matches rarity (common=3, rare=2, epic=1)', () => {
    const expected = { common: 3, rare: 2, epic: 1 } as const;
    for (const l of LANDMARKS) {
      expect(l.dropWeight, `${l.slug}`).toBe(expected[l.rarity]);
    }
  });

  it('LANDMARKS_BY_SLUG indexes every entry', () => {
    for (const l of LANDMARKS) {
      expect(LANDMARKS_BY_SLUG[l.slug]?.slug).toBe(l.slug);
    }
  });
});
