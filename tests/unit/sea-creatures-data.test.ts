import { describe, expect, it } from 'vitest';
import {
  SEA_CREATURES,
  SEA_CREATURES_BY_SLUG,
} from '@/lib/collections/seaCreaturesData';

describe('seaCreaturesData', () => {
  it('has 20 creatures', () => {
    expect(SEA_CREATURES).toHaveLength(20);
  });

  it('every entry has both nameZh and nameEn populated', () => {
    for (const c of SEA_CREATURES) {
      expect(c.nameZh, `${c.slug} nameZh`).toBeTruthy();
      expect(c.nameEn, `${c.slug} nameEn`).toBeTruthy();
    }
  });

  it('every entry has both habitatZh and habitatEn populated', () => {
    for (const c of SEA_CREATURES) {
      expect(c.habitatZh, `${c.slug} habitatZh`).toBeTruthy();
      expect(c.habitatEn, `${c.slug} habitatEn`).toBeTruthy();
    }
  });

  it('every entry has both loreZh and loreEn populated', () => {
    for (const c of SEA_CREATURES) {
      expect(c.loreZh, `${c.slug} loreZh`).toBeTruthy();
      expect(c.loreEn, `${c.slug} loreEn`).toBeTruthy();
    }
  });

  it('every entry has a creature emoji', () => {
    for (const c of SEA_CREATURES) {
      expect(c.emoji, `${c.slug} emoji`).toBeTruthy();
    }
  });

  it('slugs are unique', () => {
    const slugs = SEA_CREATURES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('rarity is one of common / rare / epic', () => {
    const valid = new Set(['common', 'rare', 'epic']);
    for (const c of SEA_CREATURES) {
      expect(valid.has(c.rarity), `${c.slug} rarity=${c.rarity}`).toBe(true);
    }
  });

  it('drop weights match rarity (3/2/1)', () => {
    const expected = { common: 3, rare: 2, epic: 1 } as const;
    for (const c of SEA_CREATURES) {
      expect(c.dropWeight, `${c.slug} dropWeight`).toBe(expected[c.rarity]);
    }
  });

  it('SEA_CREATURES_BY_SLUG indexes every entry', () => {
    for (const c of SEA_CREATURES) {
      expect(SEA_CREATURES_BY_SLUG[c.slug]?.slug).toBe(c.slug);
    }
  });

  it('includes the pirate-themed staples (octopus, shark, blue whale)', () => {
    expect(SEA_CREATURES_BY_SLUG['octopus']?.nameZh).toBe('章鱼');
    expect(SEA_CREATURES_BY_SLUG['shark']?.nameZh).toBe('鲨鱼');
    expect(SEA_CREATURES_BY_SLUG['blue-whale']?.nameZh).toBe('蓝鲸');
  });

  it('includes at least one epic creature', () => {
    expect(SEA_CREATURES.some((c) => c.rarity === 'epic')).toBe(true);
  });
});
