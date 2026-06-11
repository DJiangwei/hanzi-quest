'use client';

import { useState, useCallback, useTransition } from 'react';
import { getRoom, type HomeRoomId } from '@/lib/home/rooms';
import { getFurniture } from '@/lib/home/furniture-catalog';
import type { SurfaceKind } from '@/lib/home/surfaces';
import { RoomTabs } from './RoomTabs';
import { RoomCanvas } from './RoomCanvas';
import { FurnitureTray } from './FurnitureTray';
import { SurfacePicker } from './SurfacePicker';
import {
  placeFurnitureAction,
  removeFurnitureAction,
  setRoomSurfaceAction,
} from '@/lib/actions/home';
import type { HomePlacement } from '@/lib/db/home';
import type { RoomSurface } from '@/lib/db/home-surfaces';

interface Selected {
  source: 'tray' | 'placed';
  slug: string;
}

interface Props {
  childId: string;
  ownedSlugs: string[];
  placements: HomePlacement[];
  /** Equipped wallpaper/floor per room (defaults applied server-side). */
  roomSurfaces?: Record<string, RoomSurface>;
  /** Owned surface slugs (buyable wallpapers/floors the kid purchased). */
  ownedSurfaceSlugs?: string[];
}

/**
 * Tap-to-place home room editor.
 *
 * State machine:
 *   activeRoom  — which of the 3 rooms is displayed
 *   mode        — 'view' (browse) | 'edit' (tap-to-place)
 *   selected    — what is being placed (from tray or lifted from canvas)
 *
 * Optimistic local placement state mirrors DB; reconciled from props on
 * next navigation (server revalidates on action success).
 */
export function HomeRoomView({
  childId,
  ownedSlugs,
  placements: initialPlacements,
  roomSurfaces: initialSurfaces = {},
  ownedSurfaceSlugs = [],
}: Props) {
  const [activeRoom, setActiveRoom] = useState<HomeRoomId>('bedroom');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [selected, setSelected] = useState<Selected | null>(null);
  // Optimistic local placements — seeded from server-fetched props
  const [localPlacements, setLocalPlacements] = useState<HomePlacement[]>(initialPlacements);
  // Optimistic local surfaces (wallpaper/floor per room)
  const [localSurfaces, setLocalSurfaces] =
    useState<Record<string, RoomSurface>>(initialSurfaces);
  const [, startTransition] = useTransition();

  const activeSurface = localSurfaces[activeRoom];

  const handleSetSurface = useCallback(
    (kind: SurfaceKind, slug: string) => {
      setLocalSurfaces((prev) => {
        const cur = prev[activeRoom];
        if (!cur) return prev;
        return {
          ...prev,
          [activeRoom]: {
            wallpaperSlug: kind === 'wallpaper' ? slug : cur.wallpaperSlug,
            floorSlug: kind === 'floor' ? slug : cur.floorSlug,
          },
        };
      });
      startTransition(async () => {
        await setRoomSurfaceAction(childId, activeRoom, kind, slug);
      });
    },
    [activeRoom, childId],
  );

  // Slugs placed in ANY room (to filter tray)
  const placedSlugs = new Set(localPlacements.map((p) => p.slug));
  const unplacedSlugs = ownedSlugs.filter((s) => !placedSlugs.has(s));

  // Lifted slug: when source='placed', the item is logically "in hand" so
  // remove from occupied cells during valid-cell computation
  const liftedSlug = selected?.source === 'placed' ? selected.slug : null;

  function enterEdit() {
    setMode('edit');
    setSelected(null);
  }
  function exitEdit() {
    setMode('view');
    setSelected(null);
  }

  /** Tap a tray item → select it for placement. */
  const handleTraySelect = useCallback((slug: string) => {
    setSelected((prev) =>
      prev?.slug === slug && prev.source === 'tray' ? null : { source: 'tray', slug },
    );
  }, []);

  /** Tap a placed item in edit mode → lift it (select for move/remove). */
  const handlePlacedTap = useCallback((slug: string) => {
    setSelected((prev) =>
      prev?.slug === slug && prev.source === 'placed' ? null : { source: 'placed', slug },
    );
  }, []);

  /** Tap a valid cell → place the selected item. */
  const handleCellTap = useCallback(
    (x: number, y: number) => {
      if (!selected) return;
      const { slug } = selected;
      const def = getFurniture(slug);
      if (!def) return;

      // Optimistic update: remove old placement + add new
      setLocalPlacements((prev) => {
        const without = prev.filter((p) => !(p.slug === slug));
        return [...without, { room: activeRoom, slug, x, y }];
      });
      setSelected(null);

      // Server action (fire-and-forget; server revalidation syncs on next nav)
      startTransition(async () => {
        await placeFurnitureAction(childId, activeRoom, slug, x, y);
      });
    },
    [selected, activeRoom, childId],
  );

  /** "Put away" button → remove placement entirely. */
  const handlePutAway = useCallback(() => {
    if (!selected || selected.source !== 'placed') return;
    const { slug } = selected;

    // Optimistic update
    setLocalPlacements((prev) => prev.filter((p) => p.slug !== slug));
    setSelected(null);

    startTransition(async () => {
      await removeFurnitureAction(childId, slug);
    });
  }, [selected, childId]);

  const isLiftedItem = selected?.source === 'placed';

  return (
    <div className="flex flex-col gap-3">
      {/* Room tabs */}
      <RoomTabs activeRoom={activeRoom} onSwitch={(r) => { setActiveRoom(r); setSelected(null); }} />

      {/* Edit / Done toggle */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-hanzi text-lg font-bold text-[var(--color-ocean-900)]">
          {(() => {
            const r = getRoom(activeRoom);
            return r ? `${r.emoji} ${r.nameZh} / ${r.nameEn}` : activeRoom;
          })()}
        </h2>
        <button
          onClick={mode === 'edit' ? exitEdit : enterEdit}
          className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-xl bg-white/80 px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-white"
          aria-label={mode === 'edit' ? 'Done editing' : 'Edit room'}
        >
          {mode === 'edit' ? '✅ 完成 / Done' : '✏️ 布置 / Edit'}
        </button>
      </div>

      {/* Canvas */}
      <RoomCanvas
        activeRoom={activeRoom}
        placements={localPlacements}
        mode={mode}
        selectedSlug={selected?.slug ?? null}
        liftedSlug={liftedSlug}
        wallpaperSlug={activeSurface?.wallpaperSlug}
        floorSlug={activeSurface?.floorSlug}
        onPlacedTap={handlePlacedTap}
        onCellTap={handleCellTap}
      />

      {/* Edit-mode controls */}
      {mode === 'edit' && (
        <div className="flex flex-col gap-2">
          {/* "Put away" action for lifted item */}
          {isLiftedItem && selected && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-sand-700)]">
                已选中 / Selected:{' '}
                {(() => {
                  const def = getFurniture(selected.slug);
                  return def ? `${def.nameZh} / ${def.nameEn}` : selected.slug;
                })()}
              </span>
              <button
                onClick={handlePutAway}
                className="ml-auto flex min-h-[44px] items-center gap-1 rounded-xl bg-[var(--color-sunset-100)] px-3 py-2 text-sm font-medium text-[var(--color-sunset-700)] shadow-sm transition-colors hover:bg-[var(--color-sunset-200)]"
                aria-label="Put away this item"
              >
                ↩︎ 收起 / Put away
              </button>
            </div>
          )}

          {/* Instruction hint */}
          {selected && !isLiftedItem && (
            <p className="text-center text-xs text-[var(--color-sand-600)]">
              点击绿色区域放置 / Tap a green area to place
            </p>
          )}
          {!selected && (
            <p className="text-center text-xs text-[var(--color-sand-600)]">
              选择下方家具或点击已摆放的物品 / Select furniture below or tap placed items
            </p>
          )}

          {/* Furniture tray */}
          <FurnitureTray
            unplacedSlugs={unplacedSlugs}
            selectedSlug={selected?.source === 'tray' ? selected.slug : null}
            onSelect={handleTraySelect}
          />

          {/* Wallpaper + floor picker for this room */}
          {activeSurface && (
            <SurfacePicker
              ownedSurfaceSlugs={ownedSurfaceSlugs}
              wallpaperSlug={activeSurface.wallpaperSlug}
              floorSlug={activeSurface.floorSlug}
              onSelect={handleSetSurface}
            />
          )}
        </div>
      )}
    </div>
  );
}
