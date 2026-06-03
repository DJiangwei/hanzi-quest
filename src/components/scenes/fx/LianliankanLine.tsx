'use client';

import { type Cell } from '@/lib/scenes/lianliankan';

interface Props {
  path: Cell[];
  cols: number;
  rows: number;
  cellPx: number;
}

export function LianliankanLine({ path, cols, rows, cellPx }: Props) {
  if (path.length < 2) return null;
  const points = path
    .map((p) => `${p.col * cellPx + cellPx / 2},${p.row * cellPx + cellPx / 2}`)
    .join(' ');
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      viewBox={`0 0 ${cols * cellPx} ${rows * cellPx}`}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="rgb(56,189,248)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
