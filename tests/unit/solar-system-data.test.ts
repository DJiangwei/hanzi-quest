import { describe, expect, it } from 'vitest';
import {
  SOLAR_BODIES,
  SOLAR_BODIES_BY_SLUG,
  TYPE_LABELS,
} from '@/lib/collections/solarSystemData';

describe('solarSystemData', () => {
  it('has 10 bodies (8 planets + Sun + Moon)', () => {
    expect(SOLAR_BODIES).toHaveLength(10);
  });

  it('every entry has both nameZh and nameEn populated', () => {
    for (const b of SOLAR_BODIES) {
      expect(b.nameZh, `${b.slug} nameZh`).toBeTruthy();
      expect(b.nameEn, `${b.slug} nameEn`).toBeTruthy();
    }
  });

  it('every entry has both loreZh and loreEn populated', () => {
    for (const b of SOLAR_BODIES) {
      expect(b.loreZh, `${b.slug} loreZh`).toBeTruthy();
      expect(b.loreEn, `${b.slug} loreEn`).toBeTruthy();
    }
  });

  it('every entry has a non-empty emoji', () => {
    for (const b of SOLAR_BODIES) {
      expect(b.emoji, `${b.slug} emoji`).toBeTruthy();
    }
  });

  it('slugs are unique', () => {
    const slugs = SOLAR_BODIES.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('rarity is one of common / rare / epic', () => {
    const valid = new Set(['common', 'rare', 'epic']);
    for (const b of SOLAR_BODIES) {
      expect(valid.has(b.rarity), `${b.slug} rarity=${b.rarity}`).toBe(true);
    }
  });

  it('drop weights match rarity (3/2/1)', () => {
    const expected = { common: 3, rare: 2, epic: 1 } as const;
    for (const b of SOLAR_BODIES) {
      expect(b.dropWeight, `${b.slug} dropWeight`).toBe(expected[b.rarity]);
    }
  });

  it('type is one of the five known categories', () => {
    const valid = new Set(['rocky', 'gas', 'ice', 'star', 'moon']);
    for (const b of SOLAR_BODIES) {
      expect(valid.has(b.type), `${b.slug} type=${b.type}`).toBe(true);
    }
  });

  it('TYPE_LABELS is bilingual for every type', () => {
    for (const t of Object.keys(TYPE_LABELS)) {
      const label = TYPE_LABELS[t as keyof typeof TYPE_LABELS];
      expect(label.zh).toBeTruthy();
      expect(label.en).toBeTruthy();
    }
  });

  it('SOLAR_BODIES_BY_SLUG indexes every entry', () => {
    for (const b of SOLAR_BODIES) {
      expect(SOLAR_BODIES_BY_SLUG[b.slug]?.slug).toBe(b.slug);
    }
  });

  it('includes Earth, Moon and Sun as the kid-relevant staples', () => {
    expect(SOLAR_BODIES_BY_SLUG['earth']?.nameZh).toBe('地球');
    expect(SOLAR_BODIES_BY_SLUG['moon']?.nameZh).toBe('月球');
    expect(SOLAR_BODIES_BY_SLUG['sun']?.nameZh).toBe('太阳');
  });

  it('the Sun is epic, not a planet', () => {
    expect(SOLAR_BODIES_BY_SLUG['sun']?.rarity).toBe('epic');
    expect(SOLAR_BODIES_BY_SLUG['sun']?.type).toBe('star');
  });

  it('Saturn uses the 🪐 emoji (only planet emoji)', () => {
    expect(SOLAR_BODIES_BY_SLUG['saturn']?.emoji).toBe('🪐');
  });
});
