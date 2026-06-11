import { describe, expect, it, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  surfaceRows: [] as Array<{ room: string; wallpaperSlug: string; floorSlug: string }>,
  existingRow: [] as Array<{ wallpaperSlug: string; floorSlug: string }>,
  owned: [] as string[],
  inserted: null as null | Record<string, unknown>,
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          // getRoomSurfaces awaits .where(); setRoomSurface uses .where().limit(1)
          then: (r: (v: unknown) => unknown) => Promise.resolve(h.surfaceRows).then(r),
          limit: () => Promise.resolve(h.existingRow),
        }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoUpdate: () => {
          h.inserted = v;
          return Promise.resolve(undefined);
        },
      }),
    }),
  },
}));

vi.mock('@/lib/db/home', () => ({
  getOwnedFurnitureSlugs: () => Promise.resolve(h.owned),
}));

import {
  getRoomSurfaces,
  setRoomSurface,
  SurfaceNotOwnedError,
  InvalidSurfaceError,
} from '@/lib/db/home-surfaces';

beforeEach(() => {
  h.surfaceRows = [];
  h.existingRow = [];
  h.owned = [];
  h.inserted = null;
});

describe('getRoomSurfaces', () => {
  it('returns room defaults when there are no rows', async () => {
    const res = await getRoomSurfaces('c1');
    expect(res.bedroom).toEqual({ wallpaperSlug: 'wall-peach', floorSlug: 'floor-honey' });
    expect(res.living).toEqual({ wallpaperSlug: 'wall-blue', floorSlug: 'floor-stone' });
  });

  it('uses the equipped row when present', async () => {
    h.surfaceRows = [{ room: 'bedroom', wallpaperSlug: 'wall-stars', floorSlug: 'floor-checker' }];
    const res = await getRoomSurfaces('c1');
    expect(res.bedroom).toEqual({ wallpaperSlug: 'wall-stars', floorSlug: 'floor-checker' });
    // Other rooms still default.
    expect(res.living.wallpaperSlug).toBe('wall-blue');
  });
});

describe('setRoomSurface', () => {
  it('equips a free default without an ownership check', async () => {
    const res = await setRoomSurface('c1', 'bedroom', 'wallpaper', 'wall-blue');
    expect(res.wallpaperSlug).toBe('wall-blue');
    expect(res.floorSlug).toBe('floor-honey'); // preserved default
    expect(h.inserted?.wallpaperSlug).toBe('wall-blue');
  });

  it('rejects a buyable surface the child does not own', async () => {
    h.owned = [];
    await expect(setRoomSurface('c1', 'bedroom', 'wallpaper', 'wall-stars')).rejects.toBeInstanceOf(
      SurfaceNotOwnedError,
    );
  });

  it('equips a buyable surface the child owns, preserving the other axis', async () => {
    h.owned = ['floor-checker'];
    h.existingRow = [{ wallpaperSlug: 'wall-stars', floorSlug: 'floor-honey' }];
    const res = await setRoomSurface('c1', 'bedroom', 'floor', 'floor-checker');
    expect(res.floorSlug).toBe('floor-checker');
    expect(res.wallpaperSlug).toBe('wall-stars'); // preserved from existing row
  });

  it('rejects an unknown slug / wrong kind', async () => {
    await expect(setRoomSurface('c1', 'bedroom', 'wallpaper', 'floor-checker')).rejects.toBeInstanceOf(
      InvalidSurfaceError,
    );
    await expect(setRoomSurface('c1', 'bedroom', 'wallpaper', 'nope')).rejects.toBeInstanceOf(
      InvalidSurfaceError,
    );
  });
});
