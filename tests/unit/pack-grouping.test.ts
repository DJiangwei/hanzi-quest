import { describe, expect, it } from 'vitest';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { FLAGS } from '@/lib/collections/flagsData';
import { SOLAR_BODIES } from '@/lib/collections/solarSystemData';

describe('pack grouping config', () => {
  it('flags-v1 groups every flag into a continent in its order', () => {
    const g = getPackMeta('flags-v1')!.grouping!;
    expect(g).toBeDefined();
    for (const f of FLAGS) {
      const key = g.resolveGroup(f.slug);
      expect(key, `${f.slug}`).not.toBeNull();
      expect(g.order, `${f.slug}`).toContain(key);
      expect(g.labels[key!]).toBeDefined();
    }
  });

  it('solar-system-v1 groups every body into a type in its order', () => {
    const g = getPackMeta('solar-system-v1')!.grouping!;
    expect(g).toBeDefined();
    for (const b of SOLAR_BODIES) {
      const key = g.resolveGroup(b.slug);
      expect(g.order).toContain(key);
      expect(g.labels[key!]).toBeDefined();
    }
  });

  it('non-grouped packs (zodiac, dinosaurs) have no grouping', () => {
    expect(getPackMeta('zodiac-v1')!.grouping).toBeUndefined();
    expect(getPackMeta('dinosaurs-v1')!.grouping).toBeUndefined();
  });

  it('resolveGroup returns null for an unknown slug', () => {
    expect(getPackMeta('flags-v1')!.grouping!.resolveGroup('nope')).toBeNull();
  });
});
