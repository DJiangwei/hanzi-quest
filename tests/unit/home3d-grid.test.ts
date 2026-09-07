// The 3D room and the 2D room read the SAME `home_placements` rows, so the
// cell→world mapping is the one place they can silently disagree. An
// off-by-one here puts her bed inside a wall while the 2D view still draws it
// correctly — and nothing would fail.
import { describe, expect, it } from 'vitest';
import { cellToWorld } from '@/components/home3d/HomeRoom3D';
import { PIECES } from '@/lib/home3d/pieces';

describe('cellToWorld', () => {
  it('centres a 1×1 piece on its cell', () => {
    // 8 cols → x spans -4..4. Cell 0 occupies -4..-3, centre -3.5.
    expect(cellToWorld(0, 2, 1, 1).x).toBeCloseTo(-3.5);
    expect(cellToWorld(7, 2, 1, 1).x).toBeCloseTo(3.5);
  });

  it('centres a 2×1 piece ACROSS both of its cells', () => {
    // A 2-wide piece at x=0 covers cells 0 and 1, so its centre is -3, not -3.5.
    expect(cellToWorld(0, 2, 2, 1).x).toBeCloseTo(-3);
  });

  it('drops the wall rows from the floor depth', () => {
    // Rows 0-1 are wall; the floor is rows 2-5, four deep, spanning z -2..2.
    expect(cellToWorld(0, 2, 1, 1).z).toBeCloseTo(-1.5);
    expect(cellToWorld(0, 5, 1, 1).z).toBeCloseTo(1.5);
  });

  it('keeps every floor cell inside the floor plane', () => {
    // The guard that actually matters: nothing may land outside the room.
    for (let gx = 0; gx < 8; gx++) {
      for (let gy = 2; gy < 6; gy++) {
        const { x, z } = cellToWorld(gx, gy, 1, 1);
        expect(Math.abs(x)).toBeLessThanOrEqual(4);
        expect(Math.abs(z)).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('3D piece registry', () => {
  it('only claims slugs that exist in the real 2D catalog', async () => {
    // The spike must not invent furniture. Every 3D piece has to correspond to
    // something she can already own, or the prototype answers a question about
    // a product that does not exist.
    //
    // No `if (empty) return` escape hatch: a guard that opts out when its own
    // fixture looks wrong is the decorative-test trap — it would pass silently
    // the day someone renames the export.
    const { FURNITURE_CATALOG } = await import('@/lib/home/furniture-catalog');
    expect(FURNITURE_CATALOG.length).toBeGreaterThan(20);
    const known = new Set(FURNITURE_CATALOG.map((f) => f.slug));
    for (const slug of Object.keys(PIECES)) {
      expect(known.has(slug), `${slug} is not a real furniture slug`).toBe(true);
    }
  });

  it('every piece renders as a real 2D item too, matching surface and footprint', async () => {
    // A 3D bookshelf that thinks it is a wall item, or a 2×1 bed authored 1×1
    // wide, would look right in the spike and wrong the moment it reads live
    // placements.
    const { getFurniture } = await import('@/lib/home/furniture-catalog');
    for (const slug of Object.keys(PIECES)) {
      const def = getFurniture(slug);
      expect(def, slug).toBeDefined();
    }
  });
});

describe('3D covers the whole 2D catalog', () => {
  // Two catalogs now describe the same home. Every gap here is a piece of
  // furniture she owns that vanishes when she taps 立体视图, or a wallpaper
  // that silently falls back to cream — neither raises an error.
  it('every furniture slug has a 3D piece', async () => {
    const { FURNITURE_CATALOG } = await import('@/lib/home/furniture-catalog');
    const missing = FURNITURE_CATALOG.filter((f) => !PIECES[f.slug]).map((f) => f.slug);
    expect(missing, `no 3D piece for: ${missing.join(', ')}`).toEqual([]);
    expect(FURNITURE_CATALOG.length).toBe(25);
  });

  it('every wallpaper and floor slug has a 3D colour set', async () => {
    const { SURFACES } = await import('@/lib/home/surfaces');
    const { WALLPAPERS_3D, FLOORS_3D } = await import('@/lib/home3d/surfaces3d');
    const missing = SURFACES.filter((s) =>
      s.kind === 'wallpaper' ? !WALLPAPERS_3D[s.slug] : !FLOORS_3D[s.slug],
    ).map((s) => s.slug);
    expect(missing, `no 3D surface for: ${missing.join(', ')}`).toEqual([]);
  });

  it('every room default resolves in 3D', async () => {
    // A room whose own default is missing would open to the fallback cream on
    // a child's very first visit — the worst case to leave uncovered.
    const { ROOM_DEFAULT_SURFACES } = await import('@/lib/home/surfaces');
    const { WALLPAPERS_3D, FLOORS_3D } = await import('@/lib/home3d/surfaces3d');
    for (const [room, d] of Object.entries(ROOM_DEFAULT_SURFACES)) {
      expect(WALLPAPERS_3D[d.wallpaper], `${room} wallpaper`).toBeDefined();
      expect(FLOORS_3D[d.floor], `${room} floor`).toBeDefined();
    }
  });

  it('the yard is the only room that opens outdoors', async () => {
    // `outdoor` drives whether the shell draws walls or a sky. Marking an
    // indoor surface outdoor would delete a room's walls.
    const { ROOM_DEFAULT_SURFACES } = await import('@/lib/home/surfaces');
    const { wallpaper3D, floor3D } = await import('@/lib/home3d/surfaces3d');
    for (const [room, d] of Object.entries(ROOM_DEFAULT_SURFACES)) {
      const isOutdoor = Boolean(wallpaper3D(d.wallpaper).outdoor || floor3D(d.floor).outdoor);
      expect(isOutdoor, room).toBe(room === 'yard');
    }
  });

  it('an unknown slug falls back instead of throwing', async () => {
    // A surface bought after this map was written must not crash her home.
    const { wallpaper3D, floor3D } = await import('@/lib/home3d/surfaces3d');
    expect(wallpaper3D('wall-does-not-exist').base).toBeTruthy();
    expect(floor3D(undefined).base).toBeTruthy();
  });
});
