'use client';

import Link from 'next/link';

/**
 * The world map a child sees on /play/[childId]: a vertical zigzag of
 * islands, one per published week, connected by a hand-drawn dotted path.
 *
 * Each island has three states:
 *   - completed (100%): treasure-gold sand + ⭐ on top
 *   - active (not yet completed, but next in order): bigger, gentle pulse
 *   - reachable (later in order, not yet started): default ocean palette
 *
 * We do not gate progression — any island is tappable. State is purely a
 * visual hint about where the child is in the voyage.
 *
 * Layout: islands snake from top-left → top-right → bottom-left → … inside
 * a 360-wide viewport that scales to the container width. Vertical scroll
 * if the screen is shorter than the SVG height. Island spacing tuned so 10
 * islands feel like a real voyage on an iPad portrait screen.
 */

interface IslandInput {
  weekId: string;
  weekNumber: number;
  label: string;
  completionPercent: number;
}

interface Props {
  childId: string;
  islands: IslandInput[];
}

const ISLAND_RADIUS = 36;
const HORIZONTAL_AMPLITUDE = 100; // px from center
const VERTICAL_SPACING = 150;     // px between islands
const TOP_PADDING = 80;
const BOTTOM_PADDING = 80;
const SVG_WIDTH = 360;

function positionFor(index: number): { x: number; y: number } {
  // Zigzag: even indexes (0, 2, 4…) lean left of centre, odd lean right.
  // Centre is x = SVG_WIDTH / 2.
  const sign = index % 2 === 0 ? -1 : 1;
  const x = SVG_WIDTH / 2 + sign * HORIZONTAL_AMPLITUDE;
  const y = TOP_PADDING + index * VERTICAL_SPACING;
  return { x, y };
}

function pathBetween(a: { x: number; y: number }, b: { x: number; y: number }): string {
  // A gentle quadratic curve with the control point pulled toward the
  // midpoint vertically and pushed slightly toward island a's side
  // horizontally — gives the dotted route an arc rather than a kink.
  const midY = (a.y + b.y) / 2;
  const cx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} Q ${cx} ${midY} ${b.x} ${b.y}`;
}

export function IslandMap({ childId, islands }: Props) {
  const total = islands.length;
  if (total === 0) return null;

  const svgHeight = TOP_PADDING + (total - 1) * VERTICAL_SPACING + BOTTOM_PADDING;
  const activeIndex = islands.findIndex((i) => i.completionPercent < 100);
  const allDone = activeIndex === -1;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        className="block h-auto w-full"
        aria-hidden
      >
        {/* Dotted path between consecutive islands */}
        {islands.slice(0, -1).map((_, idx) => {
          const a = positionFor(idx);
          const b = positionFor(idx + 1);
          const done =
            islands[idx].completionPercent >= 100 &&
            islands[idx + 1].completionPercent >= 100;
          return (
            <path
              key={`path-${idx}`}
              d={pathBetween(a, b)}
              fill="none"
              stroke={done ? 'var(--color-treasure-500)' : 'var(--color-ocean-300)'}
              strokeWidth={4}
              strokeDasharray="2 10"
              strokeLinecap="round"
              opacity={done ? 0.9 : 0.55}
            />
          );
        })}

        {/* Decorative subtle waves */}
        {Array.from({ length: 6 }).map((_, i) => (
          <path
            key={`wave-${i}`}
            d={`M -10 ${100 + i * 250} Q 90 ${80 + i * 250} 200 ${100 + i * 250} T 380 ${100 + i * 250}`}
            fill="none"
            stroke="var(--color-ocean-300)"
            strokeWidth={2}
            opacity={0.12}
          />
        ))}

        {/* Islands */}
        {islands.map((island, idx) => {
          const { x, y } = positionFor(idx);
          const done = island.completionPercent >= 100;
          const isActive = !done && idx === activeIndex;
          const palmCount = ((island.weekNumber - 1) % 3) + 1;
          return (
            <IslandNode
              key={island.weekId}
              x={x}
              y={y}
              weekNumber={island.weekNumber}
              palmCount={palmCount}
              done={done}
              isActive={isActive}
            />
          );
        })}
      </svg>

      {/* Clickable hit regions overlaid on top of the SVG. We render Link
          children separately so navigation works without piercing SVG
          event handling. */}
      <div className="pointer-events-none absolute inset-0">
        {islands.map((island, idx) => {
          const { x, y } = positionFor(idx);
          const xPct = (x / SVG_WIDTH) * 100;
          const yPct = (y / svgHeight) * 100;
          return (
            <Link
              key={island.weekId}
              href={`/play/${childId}/level/${island.weekId}`}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sunset-400)]"
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                width: `${(ISLAND_RADIUS * 2 + 16) / SVG_WIDTH * 100}%`,
                aspectRatio: '1 / 1',
              }}
              aria-label={`Open ${island.label}, ${island.completionPercent}% complete`}
            />
          );
        })}
      </div>

      {allDone ? (
        <p className="mt-6 text-center text-sm font-semibold text-[var(--color-treasure-700)]">
          🏴‍☠️ All islands cleared! You found every treasure.
        </p>
      ) : null}
    </div>
  );
}

interface IslandNodeProps {
  x: number;
  y: number;
  weekNumber: number;
  palmCount: number;
  done: boolean;
  isActive: boolean;
}

function IslandNode({ x, y, weekNumber, palmCount, done, isActive }: IslandNodeProps) {
  const sandFill = done ? 'var(--color-treasure-400)' : 'var(--color-sunset-100)';
  const sandStroke = done
    ? 'var(--color-treasure-700)'
    : 'var(--color-sunset-400)';
  const numberColor = done
    ? 'var(--color-treasure-700)'
    : 'var(--color-ocean-900)';
  const numberBg = done ? '#fff8e1' : '#ffffff';
  const scale = isActive ? 1.08 : 1;

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* Pulse ring when active */}
      {isActive ? (
        <circle
          r={ISLAND_RADIUS + 14}
          fill="none"
          stroke="var(--color-sunset-400)"
          strokeWidth={3}
          opacity={0.55}
          className="island-pulse"
        />
      ) : null}

      {/* Sandy island */}
      <ellipse
        cx={0}
        cy={6}
        rx={ISLAND_RADIUS}
        ry={ISLAND_RADIUS * 0.78}
        fill={sandFill}
        stroke={sandStroke}
        strokeWidth={2}
      />

      {/* Palm trees: a small dark-green V shape for each */}
      {Array.from({ length: palmCount }).map((_, i) => {
        const dx = (i - (palmCount - 1) / 2) * 14;
        return (
          <g key={`palm-${i}`} transform={`translate(${dx} -8)`}>
            <rect x={-1.5} y={-2} width={3} height={20} fill="#7a4a1f" rx={1} />
            <path
              d="M0 -2 q -10 -6 -16 -2 q 12 -2 16 4 z"
              fill="#3b8a4a"
            />
            <path
              d="M0 -2 q 10 -6 16 -2 q -12 -2 -16 4 z"
              fill="#46a05a"
            />
            <path
              d="M0 -2 q -2 -10 4 -14 q 0 8 -4 14 z"
              fill="#5cb86b"
            />
          </g>
        );
      })}

      {/* Number / star */}
      <g transform={`translate(0 ${ISLAND_RADIUS - 4})`}>
        <circle r={18} fill={numberBg} stroke={sandStroke} strokeWidth={2} />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={done ? 22 : 18}
          fontWeight={700}
          fill={numberColor}
          fontFamily="system-ui, sans-serif"
        >
          {done ? '⭐' : weekNumber}
        </text>
      </g>
    </g>
  );
}
