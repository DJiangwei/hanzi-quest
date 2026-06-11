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
      {/* Soft contact shadow beneath the item — grounds it in the room (2.5D
          depth). Floor items get a fuller shadow; wall items a faint one. */}
      <ellipse
        cx={w / 2}
        cy={def.surface === 'wall' ? h - 0.6 : h - 1.2}
        rx={w * 0.42}
        ry={def.surface === 'wall' ? 0.7 : 1.6}
        fill="#1a1208"
        opacity={def.surface === 'wall' ? 0.08 : 0.13}
      />
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
