import { describe, expect, it } from 'vitest';
import {
  FLAGS,
  FLAGS_BY_SLUG,
  flagEmojiFromIso2,
  CONTINENT_ORDER,
} from '@/lib/collections/flagsData';

describe('flagsData', () => {
  it('contains all 193 UN member states', () => {
    expect(FLAGS).toHaveLength(193);
  });

  it('every entry has bilingual name, capital, and lore', () => {
    for (const f of FLAGS) {
      expect(f.nameZh, `${f.slug} nameZh`).toBeTruthy();
      expect(f.nameEn, `${f.slug} nameEn`).toBeTruthy();
      expect(f.capitalZh, `${f.slug} capitalZh`).toBeTruthy();
      expect(f.capitalEn, `${f.slug} capitalEn`).toBeTruthy();
      expect(f.loreZh, `${f.slug} loreZh`).toBeTruthy();
      expect(f.loreEn, `${f.slug} loreEn`).toBeTruthy();
    }
  });

  it('every entry has a 2-letter iso2 and a derived emoji', () => {
    for (const f of FLAGS) {
      expect(f.iso2, `${f.slug} iso2`).toMatch(/^[a-z]{2}$/);
      expect(f.emoji, `${f.slug} emoji`).toBe(flagEmojiFromIso2(f.iso2));
    }
  });

  it('every entry has a valid continent in CONTINENT_ORDER', () => {
    for (const f of FLAGS) {
      expect(CONTINENT_ORDER, `${f.slug} continent`).toContain(f.continent);
    }
  });

  it('every continent has at least one country', () => {
    for (const c of CONTINENT_ORDER) {
      expect(
        FLAGS.some((f) => f.continent === c),
        `continent ${c} is empty`,
      ).toBe(true);
    }
  });

  it('slugs and iso2 codes are unique', () => {
    const slugs = FLAGS.map((f) => f.slug);
    const isos = FLAGS.map((f) => f.iso2);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it('rarity is one of common / rare / epic', () => {
    const valid = new Set(['common', 'rare', 'epic']);
    for (const f of FLAGS) {
      expect(valid.has(f.rarity), `${f.slug} rarity=${f.rarity}`).toBe(true);
    }
  });

  it('dropWeight matches rarity (common=3, rare=2, epic=1)', () => {
    const expected = { common: 3, rare: 2, epic: 1 } as const;
    for (const f of FLAGS) {
      expect(f.dropWeight, `${f.slug}`).toBe(expected[f.rarity]);
    }
  });

  it('FLAGS_BY_SLUG indexes every entry', () => {
    for (const f of FLAGS) {
      expect(FLAGS_BY_SLUG[f.slug]?.slug).toBe(f.slug);
    }
  });

  it('keeps the original Yinuo-relevant countries', () => {
    expect(FLAGS_BY_SLUG['uk']?.nameZh).toBe('英国');
    expect(FLAGS_BY_SLUG['uk']?.iso2).toBe('gb');
    expect(FLAGS_BY_SLUG['china']?.nameZh).toBe('中国');
    expect(FLAGS_BY_SLUG['china']?.continent).toBe('asia');
    expect(FLAGS_BY_SLUG['usa']?.nameZh).toBe('美国');
    expect(FLAGS_BY_SLUG['usa']?.continent).toBe('north_america');
  });

  it('excludes disputed / non-UN territories', () => {
    for (const slug of [
      'taiwan',
      'kosovo',
      'palestine',
      'western-sahara',
      'vatican',
    ]) {
      expect(FLAGS_BY_SLUG[slug], `${slug} should be excluded`).toBeUndefined();
    }
  });
});
