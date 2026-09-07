'use client';

import { useState } from 'react';
import { getFurniture } from '@/lib/home/furniture-catalog';
import { ROOM_DEFAULT_SURFACES } from '@/lib/home/surfaces';
import { HOME_ROOMS, type HomeRoomId } from '@/lib/home/rooms';
import { Room3DMount } from './Room3DMount';
import type { Placed3D } from './HomeRoom3D';
import type { HomePlacement } from '@/lib/db/home';

export interface RoomSurfacePair {
  wallpaperSlug: string;
  floorSlug: string;
}

/**
 * The 3D home, reading the SAME `home_placements` rows the 2D view draws.
 *
 * **Additive, never a replacement.** The 2D room keeps the editor — tap a cell,
 * place a copy, server-validated — and this is a view of the result. Two
 * reasons it is not a swap: rebuilding the edit interaction in 3D means
 * raycasting a moving grid, which is the riskiest part of the module and the
 * only part that is actual gameplay; and if WebGL fails on her iPad, a decorated
 * home should still be visible rather than gone.
 *
 * Footprints and surfaces come from the real catalogs, so a piece cannot be
 * placed at a different size here than the 2D view gives it.
 */
export function Room3DPanel({
  placements,
  roomSurfaces,
}: {
  placements: HomePlacement[];
  roomSurfaces?: Record<string, RoomSurfacePair>;
}) {
  const [room, setRoom] = useState<HomeRoomId>('bedroom');

  const placed: Placed3D[] = placements
    .filter((p) => p.room === room)
    .flatMap((p) => {
      const def = getFurniture(p.slug);
      // A placement whose slug has no catalog entry is skipped, not defaulted:
      // guessing a footprint would put it through a wall.
      if (!def) return [];
      return [
        {
          slug: p.slug,
          gridX: p.x,
          gridY: p.y,
          w: def.footprint.w,
          h: def.footprint.h,
          surface: def.surface,
        },
      ];
    });

  // The two sources spell the same thing differently — the DB row is
  // { wallpaperSlug, floorSlug } and the catalog default is
  // { wallpaper, floor }. Normalised here rather than guessing one shape.
  const equipped = roomSurfaces?.[room];
  const fallback = ROOM_DEFAULT_SURFACES[room];
  const wallpaperSlug = equipped?.wallpaperSlug ?? fallback?.wallpaper;
  const floorSlug = equipped?.floorSlug ?? fallback?.floor;

  return (
    <div className="flex flex-col gap-2" data-testid="room-3d-panel">
      <div className="flex flex-wrap gap-1.5">
        {HOME_ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            data-testid={`room-3d-tab-${r.id}`}
            onClick={() => setRoom(r.id)}
            aria-pressed={room === r.id}
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
              room === r.id
                ? 'border-amber-400 bg-amber-100 text-amber-900'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            <span aria-hidden>{r.emoji}</span>{' '}
            <span className="font-hanzi">{r.nameZh}</span>{' '}
            <span className="italic">/ {r.nameEn}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-amber-200 shadow-sm">
        <Room3DMount
          key={room}
          placements={placed}
          wallpaperSlug={wallpaperSlug}
          floorSlug={floorSlug}
        />
      </div>

      {placed.length === 0 ? (
        <p className="text-center text-xs text-[var(--color-sand-700)]">
          <span className="font-hanzi">这个房间还没摆东西。</span>{' '}
          <span className="italic">/ Nothing placed in this room yet.</span>
        </p>
      ) : null}
    </div>
  );
}
