import { describe, expect, it } from 'vitest';
import { ANCHORS, type AnchorSlug } from '@/lib/decor/anchors';
import { DECOR_CATALOG } from '@/lib/decor/catalog';

describe('decor catalog invariants', () => {
  it('every catalog entry has a known anchor', () => {
    for (const [slug, entry] of Object.entries(DECOR_CATALOG)) {
      expect(ANCHORS, `slug=${slug}`).toHaveProperty(entry.anchor);
    }
  });

  it('all catalog anchors are distinct (no two items share an anchor)', () => {
    const anchors = Object.values(DECOR_CATALOG).map((e) => e.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('every catalog entry has a renderable Component', () => {
    for (const [slug, entry] of Object.entries(DECOR_CATALOG)) {
      expect(typeof entry.Component, `slug=${slug}`).toBe('function');
    }
  });

  it('catalog has the 10 expected slugs', () => {
    expect(Object.keys(DECOR_CATALOG).sort()).toEqual(
      [
        'compass-rose',
        'fish-school',
        'hibiscus',
        'lighthouse',
        'pirate-flag',
        'rainbow',
        'sailboat',
        'seagull-pair',
        'treasure-chest',
        'whale-tail',
      ].sort(),
    );
  });

  it('all ANCHORS have numeric x/y in viewBox bounds (0..360 for x, 0..1700 for y)', () => {
    for (const [slug, pos] of Object.entries(ANCHORS) as Array<[AnchorSlug, { x: number; y: number }]>) {
      expect(pos.x, slug).toBeGreaterThanOrEqual(0);
      expect(pos.x, slug).toBeLessThanOrEqual(360);
      expect(pos.y, slug).toBeGreaterThanOrEqual(0);
      expect(pos.y, slug).toBeLessThanOrEqual(1700);
    }
  });
});
