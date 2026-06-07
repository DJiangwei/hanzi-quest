'use client';

import { getFurniture } from '@/lib/home/furniture-catalog';

/** Cell width/height in SVG units (100 / 8 cols). */
const CELL = 12.5;

interface Props {
  slug: string;
  x: number;
  y: number;
  /** Whether the editor is in 'edit' mode — enables tap-to-lift. */
  editMode: boolean;
  /** Whether this item is currently "lifted" (selected for move/remove). */
  selected: boolean;
  onTap: () => void;
}

/**
 * Renders a single piece of placed furniture inside the RoomCanvas SVG.
 * Translates to the correct cell position and scales the SVG component
 * to fill the footprint.
 */
export function PlacedFurniture({ slug, x, y, editMode, selected, onTap }: Props) {
  const def = getFurniture(slug);
  if (!def) return null;

  const { footprint, Component } = def;
  const svgX = x * CELL;
  const svgY = y * CELL;
  const w = footprint.w * CELL;
  const h = footprint.h * CELL;

  return (
    <g
      data-testid="placed-furniture"
      data-slug={slug}
      transform={`translate(${svgX}, ${svgY})`}
      style={{ cursor: editMode ? 'pointer' : 'default' }}
      role={editMode ? 'button' : undefined}
      aria-label={editMode ? `${def.nameZh} / ${def.nameEn} — tap to lift` : def.nameZh}
      onClick={editMode ? onTap : undefined}
    >
      {/* Highlight ring when selected */}
      {selected && (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="none"
          stroke="#facc15"
          strokeWidth={1}
          rx={1}
          opacity={0.9}
        />
      )}
      {/* Component is drawn within a 0,0 → w,h box */}
      <svg
        x={0}
        y={0}
        width={w}
        height={h}
        viewBox={`0 0 ${footprint.w * CELL} ${footprint.h * CELL}`}
        overflow="visible"
      >
        <Component />
      </svg>
    </g>
  );
}
