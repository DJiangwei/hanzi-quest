'use client';

import { useState, type ReactNode } from 'react';
import { Room3DPanel, type RoomSurfacePair } from './Room3DPanel';
import type { HomePlacement } from '@/lib/db/home';

/**
 * 2D / 3D toggle for the home.
 *
 * **2D is the default and keeps the editor.** The 3D view is a way to look at
 * what she has built, not a replacement for building it: rebuilding placement
 * in 3D means raycasting a grid whose screen position moves, and that editor is
 * the module's only actual gameplay. Equally, if WebGL fails on her device a
 * decorated home should still be there.
 *
 * The 3D panel is only mounted once she asks for it, so three.js is never
 * fetched for a child who never taps the button — the same reason the spike
 * lived on its own route.
 */
export function HomeViewSwitch({
  twoD,
  placements,
  roomSurfaces,
}: {
  twoD: ReactNode;
  placements: HomePlacement[];
  roomSurfaces?: Record<string, RoomSurfacePair>;
}) {
  const [threeD, setThreeD] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="home-view-toggle"
          onClick={() => setThreeD((v) => !v)}
          aria-pressed={threeD}
          className="rounded-full border-2 border-amber-300 bg-white px-4 py-1.5 text-xs font-bold text-amber-900 shadow-sm transition active:scale-95"
        >
          {threeD ? (
            <>
              <span aria-hidden>🧱</span> <span className="font-hanzi">平面视图</span>{' '}
              <span className="italic">/ Flat view</span>
            </>
          ) : (
            <>
              <span aria-hidden>🏠</span> <span className="font-hanzi">立体视图</span>{' '}
              <span className="italic">/ 3D view</span>
            </>
          )}
        </button>
      </div>
      {threeD ? (
        <Room3DPanel placements={placements} roomSurfaces={roomSurfaces} />
      ) : (
        twoD
      )}
    </div>
  );
}
