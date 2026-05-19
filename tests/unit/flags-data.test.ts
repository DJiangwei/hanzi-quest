import { describe, expect, it } from 'vitest';
import { FLAGS, FLAGS_BY_SLUG } from '@/lib/collections/flagsData';

describe('flagsData', () => {
  it('has exactly 30 countries', () => {
    expect(FLAGS).toHaveLength(30);
  });

  it('every entry has both nameZh and nameEn populated', () => {
    for (const f of FLAGS) {
      expect(f.nameZh, `${f.slug} nameZh`).toBeTruthy();
      expect(f.nameEn, `${f.slug} nameEn`).toBeTruthy();
    }
  });

  it('every entry has both capitalZh and capitalEn populated', () => {
    for (const f of FLAGS) {
      expect(f.capitalZh, `${f.slug} capitalZh`).toBeTruthy();
      expect(f.capitalEn, `${f.slug} capitalEn`).toBeTruthy();
    }
  });

  it('every entry has both loreZh and loreEn populated', () => {
    for (const f of FLAGS) {
      expect(f.loreZh, `${f.slug} loreZh`).toBeTruthy();
      expect(f.loreEn, `${f.slug} loreEn`).toBeTruthy();
    }
  });

  it('every entry has a flag emoji', () => {
    for (const f of FLAGS) {
      expect(f.emoji, `${f.slug} emoji`).toBeTruthy();
      // Regional indicator emoji are 8 bytes (2 codepoints, each 4 bytes UTF-8)
      // — sanity check that the field isn't a single ASCII char by mistake.
      expect(f.emoji.length, `${f.slug} emoji length`).toBeGreaterThanOrEqual(2);
    }
  });

  it('slugs are unique', () => {
    const slugs = FLAGS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('rarity is one of common / rare / epic', () => {
    const valid = new Set(['common', 'rare', 'epic']);
    for (const f of FLAGS) {
      expect(valid.has(f.rarity), `${f.slug} rarity=${f.rarity}`).toBe(true);
    }
  });

  it('FLAGS_BY_SLUG indexes every entry', () => {
    for (const f of FLAGS) {
      expect(FLAGS_BY_SLUG[f.slug]?.slug).toBe(f.slug);
    }
  });

  it('includes Yinuo-relevant common countries (UK, China, USA)', () => {
    expect(FLAGS_BY_SLUG['uk']?.nameZh).toBe('英国');
    expect(FLAGS_BY_SLUG['china']?.nameZh).toBe('中国');
    expect(FLAGS_BY_SLUG['usa']?.nameZh).toBe('美国');
  });
});
