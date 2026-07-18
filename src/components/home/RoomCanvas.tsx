'use client';

import { useId, useMemo, useRef } from 'react';
import { getRoom, type HomeRoomId } from '@/lib/home/rooms';
import { getFurniture } from '@/lib/home/furniture-catalog';
import { getSurface, ROOM_DEFAULT_SURFACES } from '@/lib/home/surfaces';
import { cellsForFootprint, validCells, cellKey } from '@/lib/home/grid';
import { PlacedFurniture } from './PlacedFurniture';
import type { HomePlacement } from '@/lib/db/home';

/** Each cell = 12.5 SVG units (100 / 8 cols). */
const CELL = 12.5;
/** viewBox dimensions. */
const VB_W = 100;
const VB_H = 75;

interface Props {
  activeRoom: HomeRoomId;
  placements: HomePlacement[];
  mode: 'view' | 'edit';
  /** Slug of item currently selected for placement (null = nothing). */
  selectedSlug: string | null;
  /** Currently lifted placement key `slug#copyIndex` (placed item being moved). */
  liftedKey: string | null;
  /** Equipped wallpaper / floor slug for this room (falls back to room default). */
  wallpaperSlug?: string;
  floorSlug?: string;
  onPlacedTap: (slug: string, copyIndex: number) => void;
  onCellTap: (x: number, y: number) => void;
}

/** Stable per-copy identity — must match HomeRoomView.placementKey. */
function keyOf(p: { slug: string; copyIndex: number }): string {
  return `${p.slug}#${p.copyIndex}`;
}

/**
 * SVG room canvas. Renders the backdrop + placed items + optional edit overlay.
 * In edit mode with a selection, valid placement cells are highlighted green.
 */
export function RoomCanvas({
  activeRoom,
  placements,
  mode,
  selectedSlug,
  liftedKey,
  wallpaperSlug,
  floorSlug,
  onPlacedTap,
  onCellTap,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, '');
  const room = getRoom(activeRoom);

  // Placements for the active room only
  const roomPlacements = placements.filter((p) => p.room === activeRoom);

  // Build the occupied cell set (for valid-cell computation)
  // Hooks must be called unconditionally — `room` is checked inside the memo
  const occupiedCells = useMemo(() => {
    if (!room) return new Set<string>();
    const set = new Set<string>();
    for (const p of roomPlacements) {
      if (keyOf(p) === liftedKey) continue; // being moved — treat as unoccupied
      const def = getFurniture(p.slug);
      if (!def) continue;
      for (const c of cellsForFootprint(p.x, p.y, def.footprint)) {
        set.add(cellKey(c.x, c.y));
      }
    }
    return set;
  }, [room, roomPlacements, liftedKey]);

  // Valid target cells for the selected item
  const validCellSet = useMemo(() => {
    if (!selectedSlug || !room) return new Set<string>();
    const def = getFurniture(selectedSlug);
    if (!def) return new Set<string>();
    const cells = validCells(room, def.footprint, def.surface, occupiedCells);
    return new Set(cells.map((c) => cellKey(c.x, c.y)));
  }, [selectedSlug, room, occupiedCells]);

  if (!room) return null;

  // Resolve the equipped (or default) surfaces for this room.
  const def = ROOM_DEFAULT_SURFACES[activeRoom];
  const wall = getSurface(wallpaperSlug ?? def.wallpaper) ?? getSurface(def.wallpaper)!;
  const floor = getSurface(floorSlug ?? def.floor) ?? getSurface(def.floor)!;
  const coveId = `cove-${uid}`;
  const poolId = `pool-${uid}`;
  const vignetteId = `vig-${uid}`;
  const windowId = `win-${uid}`;

  // Handle click/tap on SVG surface to derive grid cell
  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (mode !== 'edit' || !selectedSlug) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = VB_W / rect.width;
    const scaleY = VB_H / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    const cellX = Math.floor(svgX / CELL);
    const cellY = Math.floor(svgY / CELL);
    if (validCellSet.has(cellKey(cellX, cellY))) {
      onCellTap(cellX, cellY);
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full rounded-xl shadow-md"
      style={{ aspectRatio: '4/3', display: 'block' }}
      onClick={handleSvgClick}
      aria-label={`${room.nameZh} / ${room.nameEn}`}
    >
      {/* Equipped wallpaper + floor surfaces */}
      {wall.render()}
      {floor.render()}

      {/* 2.5D depth overlay — cove shadow (ceiling), corner AO, window light,
          skirting/horizon line, floor light pool. Generic across all rooms. */}
      <defs>
        <linearGradient id={coveId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={poolId} cx="0.6" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#fff6e0" stopOpacity="0.30" />
          <stop offset="1" stopColor="#fff6e0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={vignetteId} cx="0.5" cy="0.46" r="0.72">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </radialGradient>
        <radialGradient id={windowId} cx="0.2" cy="0.12" r="0.55">
          <stop offset="0" stopColor="#fff7e2" stopOpacity="0.34" />
          <stop offset="1" stopColor="#fff7e2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g aria-hidden>
        {/* ceiling cove shadow */}
        <rect x={0} y={0} width={VB_W} height={7} fill={`url(#${coveId})`} />
        {/* warm light wash from the top-left (window / sun) */}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#${windowId})`} />
        {/* floor sunlight pool */}
        <ellipse cx={56} cy={46} rx={62} ry={26} fill={`url(#${poolId})`} />
        {/* skirting board / horizon line at the wall-floor seam */}
        <rect x={0} y={23.2} width={VB_W} height={2.6} fill="#000" opacity={0.10} />
        <rect x={0} y={23.2} width={VB_W} height={0.7} fill="#fff" opacity={0.20} />
        {/* corner ambient occlusion (drawn last so it frames the scene) */}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#${vignetteId})`} />
      </g>

      {/* Edit-mode faint grid */}
      {mode === 'edit' && (
        <g data-testid="room-grid" aria-hidden>
          {Array.from({ length: room.cols + 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={i * CELL}
              y1={0}
              x2={i * CELL}
              y2={VB_H}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth={0.3}
            />
          ))}
          {Array.from({ length: room.rows + 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * CELL}
              x2={VB_W}
              y2={i * CELL}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth={0.3}
            />
          ))}
        </g>
      )}

      {/* Valid placement highlight cells */}
      {mode === 'edit' && selectedSlug && (
        <g aria-hidden>
          {Array.from(validCellSet).map((key) => {
            const [cx, cy] = key.split(',').map(Number);
            const def = getFurniture(selectedSlug);
            const fw = def ? def.footprint.w * CELL : CELL;
            const fh = def ? def.footprint.h * CELL : CELL;
            return (
              <rect
                key={key}
                x={cx * CELL}
                y={cy * CELL}
                width={fw}
                height={fh}
                fill="rgba(52,211,153,0.25)"
                stroke="rgba(16,185,129,0.6)"
                strokeWidth={0.5}
                rx={0.5}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
        </g>
      )}

      {/* Placed furniture */}
      {roomPlacements.map((p) => (
        <PlacedFurniture
          key={keyOf(p)}
          slug={p.slug}
          x={p.x}
          y={p.y}
          editMode={mode === 'edit'}
          selected={keyOf(p) === liftedKey}
          onTap={() => onPlacedTap(p.slug, p.copyIndex)}
        />
      ))}
    </svg>
  );
}
