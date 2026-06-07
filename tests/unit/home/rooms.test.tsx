import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  HOME_ROOMS,
  getRoom,
  cellZone,
  type HomeRoomId,
} from '@/lib/home/rooms';

describe('HOME_ROOMS structure', () => {
  it('has exactly 3 rooms', () => {
    expect(HOME_ROOMS).toHaveLength(3);
  });

  it('contains bedroom, living, playroom', () => {
    const ids = HOME_ROOMS.map((r) => r.id);
    expect(ids).toContain('bedroom');
    expect(ids).toContain('living');
    expect(ids).toContain('playroom');
  });

  it.each(['bedroom', 'living', 'playroom'] as HomeRoomId[])(
    '%s has cols=8, rows=6, wallRows=2',
    (id) => {
      const room = getRoom(id)!;
      expect(room).toBeDefined();
      expect(room.cols).toBe(8);
      expect(room.rows).toBe(6);
      expect(room.wallRows).toBe(2);
    },
  );

  it.each(['bedroom', 'living', 'playroom'] as HomeRoomId[])(
    '%s has bilingual names',
    (id) => {
      const room = getRoom(id)!;
      expect(typeof room.nameZh).toBe('string');
      expect(room.nameZh.length).toBeGreaterThan(0);
      expect(typeof room.nameEn).toBe('string');
      expect(room.nameEn.length).toBeGreaterThan(0);
    },
  );

  it.each(['bedroom', 'living', 'playroom'] as HomeRoomId[])(
    '%s has a Backdrop function',
    (id) => {
      const room = getRoom(id)!;
      expect(typeof room.Backdrop).toBe('function');
    },
  );
});

describe('getRoom', () => {
  it('returns the room for a known id', () => {
    const room = getRoom('bedroom');
    expect(room).toBeDefined();
    expect(room!.id).toBe('bedroom');
  });

  it('returns undefined for an unknown id', () => {
    expect(getRoom('nonexistent')).toBeUndefined();
  });
});

describe('cellZone', () => {
  const bedroom = getRoom('bedroom')!;

  it('returns wall for y=0', () => {
    expect(cellZone(bedroom, 0, 0)).toBe('wall');
  });

  it('returns wall for y=1 (wallRows=2)', () => {
    expect(cellZone(bedroom, 0, 1)).toBe('wall');
  });

  it('returns floor for y=2', () => {
    expect(cellZone(bedroom, 0, 2)).toBe('floor');
  });

  it('returns floor for y=5 (last row)', () => {
    expect(cellZone(bedroom, 0, 5)).toBe('floor');
  });

  it('x coordinate does not affect zone', () => {
    expect(cellZone(bedroom, 7, 1)).toBe('wall');
    expect(cellZone(bedroom, 7, 2)).toBe('floor');
  });
});

describe('Backdrop render smoke', () => {
  it.each(['bedroom', 'living', 'playroom'] as HomeRoomId[])(
    '%s Backdrop renders without error',
    (id) => {
      const room = getRoom(id)!;
      const { Backdrop } = room;
      // render as SVG child
      const { container } = render(
        <svg viewBox="0 0 100 75">
          <Backdrop />
        </svg>,
      );
      expect(container.querySelector('svg')).not.toBeNull();
      // Should have some SVG rect elements (wall + floor panels)
      expect(container.querySelectorAll('rect').length).toBeGreaterThan(0);
    },
  );
});
