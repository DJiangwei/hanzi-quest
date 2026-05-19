import { describe, expect, it } from 'vitest';
import {
  DINOSAURS,
  DINOSAURS_BY_SLUG,
  ERA_LABELS,
} from '@/lib/collections/dinosaursData';

describe('dinosaursData', () => {
  it('has 15 dinosaurs', () => {
    expect(DINOSAURS).toHaveLength(15);
  });

  it('every entry has both nameZh and nameEn populated', () => {
    for (const d of DINOSAURS) {
      expect(d.nameZh, `${d.slug} nameZh`).toBeTruthy();
      expect(d.nameEn, `${d.slug} nameEn`).toBeTruthy();
    }
  });

  it('every entry has both loreZh and loreEn populated', () => {
    for (const d of DINOSAURS) {
      expect(d.loreZh, `${d.slug} loreZh`).toBeTruthy();
      expect(d.loreEn, `${d.slug} loreEn`).toBeTruthy();
    }
  });

  it('every entry uses either 🦖 or 🦕 emoji', () => {
    for (const d of DINOSAURS) {
      expect(['🦖', '🦕'].includes(d.emoji), `${d.slug} emoji=${d.emoji}`).toBe(
        true,
      );
    }
  });

  it('slugs are unique', () => {
    const slugs = DINOSAURS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('rarity is one of common / rare / epic', () => {
    const valid = new Set(['common', 'rare', 'epic']);
    for (const d of DINOSAURS) {
      expect(valid.has(d.rarity), `${d.slug} rarity=${d.rarity}`).toBe(true);
    }
  });

  it('drop weights match rarity (3/2/1)', () => {
    const expected = { common: 3, rare: 2, epic: 1 } as const;
    for (const d of DINOSAURS) {
      expect(d.dropWeight, `${d.slug} dropWeight`).toBe(expected[d.rarity]);
    }
  });

  it('era is one of triassic / jurassic / cretaceous', () => {
    const valid = new Set(['triassic', 'jurassic', 'cretaceous']);
    for (const d of DINOSAURS) {
      expect(valid.has(d.era), `${d.slug} era=${d.era}`).toBe(true);
    }
  });

  it('ERA_LABELS is bilingual for every era', () => {
    for (const era of Object.keys(ERA_LABELS)) {
      const label = ERA_LABELS[era as keyof typeof ERA_LABELS];
      expect(label.zh).toBeTruthy();
      expect(label.en).toBeTruthy();
    }
  });

  it('DINOSAURS_BY_SLUG indexes every entry', () => {
    for (const d of DINOSAURS) {
      expect(DINOSAURS_BY_SLUG[d.slug]?.slug).toBe(d.slug);
    }
  });

  it('includes the famous staples (T-Rex, Triceratops, Brachiosaurus)', () => {
    expect(DINOSAURS_BY_SLUG['t-rex']?.nameZh).toBe('霸王龙');
    expect(DINOSAURS_BY_SLUG['triceratops']?.nameZh).toBe('三角龙');
    expect(DINOSAURS_BY_SLUG['brachiosaurus']?.nameZh).toBe('腕龙');
  });

  it('includes at least one epic dinosaur', () => {
    expect(DINOSAURS.some((d) => d.rarity === 'epic')).toBe(true);
  });
});
