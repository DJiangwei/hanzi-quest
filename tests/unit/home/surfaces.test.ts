import { describe, expect, it } from 'vitest';
import {
  SURFACES,
  getSurface,
  listSurfaces,
  isDefaultSurface,
  ROOM_DEFAULT_SURFACES,
} from '@/lib/home/surfaces';

describe('home surfaces catalog', () => {
  it('has wallpapers and floors with unique slugs', () => {
    expect(listSurfaces('wallpaper').length).toBeGreaterThan(0);
    expect(listSurfaces('floor').length).toBeGreaterThan(0);
    expect(new Set(SURFACES.map((s) => s.slug)).size).toBe(SURFACES.length);
  });

  it('every room default resolves to a real surface of the right kind', () => {
    for (const { wallpaper, floor } of Object.values(ROOM_DEFAULT_SURFACES)) {
      const w = getSurface(wallpaper);
      const f = getSurface(floor);
      expect(w?.kind).toBe('wallpaper');
      expect(w?.isDefault).toBe(true);
      expect(f?.kind).toBe('floor');
      expect(f?.isDefault).toBe(true);
    }
  });

  it('defaults are free; buyable surfaces have a positive price', () => {
    for (const s of SURFACES) {
      if (s.isDefault) {
        expect(s.priceCoins).toBe(0);
        expect(isDefaultSurface(s.slug)).toBe(true);
      } else {
        expect(s.priceCoins).toBeGreaterThan(0);
        expect(isDefaultSurface(s.slug)).toBe(false);
      }
    }
  });

  it('every surface renders an SVG element', () => {
    for (const s of SURFACES) {
      const node = s.render();
      expect(node).toBeTruthy();
      expect(node.type).toBe('g');
    }
  });
});
