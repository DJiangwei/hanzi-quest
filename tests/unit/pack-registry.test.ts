import { describe, expect, it } from 'vitest';
import { getPackMeta, PACK_REGISTRY } from '@/lib/collections/packRegistry';

describe('vocab pack registry entries', () => {
  it.each(Object.keys(PACK_REGISTRY))(
    '%s has bilingual names + an ItemCard + reveal emoji',
    (slug) => {
      const meta = getPackMeta(slug);
      expect(meta).toBeTruthy();
      expect(meta!.displayNameZh && meta!.displayNameEn).toBeTruthy();
      expect(meta!.sloganZh && meta!.sloganEn).toBeTruthy();
      expect(meta!.ItemCard).toBeTypeOf('function');
      if (slug === 'zodiac-v1') {
        // zodiac-v1 deliberately has no resolveRevealEmoji: CardChestReveal
        // renders it via ZodiacIcon (emoji={null}) instead of resolving a
        // glyph. Every other registered pack must define one.
        expect(meta!.resolveRevealEmoji).toBeUndefined();
      } else {
        expect(meta!.resolveRevealEmoji).toBeTypeOf('function');
      }
    },
  );
  it('transport + instruments are grouped; minibeasts + animals are flat', () => {
    expect(getPackMeta('transport-v1')!.grouping).toBeTruthy();
    expect(getPackMeta('instruments-v1')!.grouping).toBeTruthy();
    expect(getPackMeta('minibeasts-v1')!.grouping).toBeUndefined();
    expect(getPackMeta('animals-v1')!.grouping).toBeUndefined();
  });
  it('olympics-v1 is grouped and uses the 4-section order', () => {
    const g = getPackMeta('olympics-v1')!.grouping!;
    expect(g).toBeTruthy();
    expect(g.order).toEqual(['water', 'ball', 'combat', 'skill']);
  });
});
