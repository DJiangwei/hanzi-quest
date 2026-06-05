'use client';

import Link from 'next/link';
import { getVoyageMap } from '@/lib/play/map-boards';
import { voyageLayout } from '@/lib/play/voyage-layout';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

export interface VoyageBoardIsland {
  weekId: string;
  completionPercent: number;
}

interface Props {
  childId: string;
  /** Pack slug — resolved to a config client-side (never pass the config object across RSC). */
  packSlug: string;
  /** Ordered by weekNumber; islands[i] occupies stops[i]. */
  islands: VoyageBoardIsland[];
}

/** Vertical room per stop, in px. Board height = stops × this → big, scrollable. */
const STOP_GAP_PX = 210;

export function VoyageBoard({ childId, packSlug, islands }: Props) {
  const map = getVoyageMap(packSlug);
  const reduced = useReducedMotion();
  if (!map) return null;

  const pos = voyageLayout(map.stops.length);
  const firstActive = islands.findIndex((i) => i.completionPercent < 100);
  const boardHeight = map.stops.length * STOP_GAP_PX;

  return (
    <div
      data-testid="voyage-board"
      style={{ height: boardHeight }}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border-[6px] border-[#b8895a] bg-[linear-gradient(180deg,#4aa6ae_0%,#2a7e86_45%,#1c6068_100%)] shadow-xl"
    >
      {/* Parchment inner trim */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#e8d6a8]/40" />

      {/* Title banner */}
      <div className="sticky top-2 z-20 mx-auto w-fit rounded-full bg-[#e8d6a8] px-5 py-1.5 text-base font-extrabold text-[#7a4a14] shadow-md">
        🧭 {map.nameZh} · {map.nameEn}
      </div>

      {/* Dotted route — stretched over the full tall board */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {pos.slice(0, -1).map((a, i) => {
          const b = pos[i + 1];
          const done =
            islands[i]?.completionPercent >= 100 && islands[i + 1]?.completionPercent >= 100;
          return (
            <line
              key={i}
              x1={a.xPct}
              y1={a.yPct}
              x2={b.xPct}
              y2={b.yPct}
              stroke={done ? '#f0c14b' : '#e8d6a8'}
              strokeWidth="0.7"
              strokeDasharray="1.4 2.2"
              strokeLinecap="round"
              opacity={done ? 0.95 : 0.7}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* Stops */}
      {map.stops.map((stop, i) => {
        const island = islands[i];
        const p = pos[i];
        const style = { left: `${p.xPct}%`, top: `${p.yPct}%` } as const;
        const num = i + 1;

        if (!island) {
          return (
            <div
              key={i}
              data-testid="voyage-stop-locked"
              className="absolute flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={style}
              aria-label={`${stop.labelEn} — locked`}
            >
              <span className="relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-[#8a6a3a] bg-[#cdbb95] text-[clamp(2.2rem,13vw,4.5rem)] opacity-60 shadow-lg">
                {stop.emoji}
                <span className="absolute bottom-1 right-1 text-2xl">🔒</span>
              </span>
              <span className="mt-1 rounded-md bg-black/40 px-2 py-0.5 text-center text-xs font-semibold leading-tight text-white">
                {stop.labelZh}
                <span className="block text-[10px] opacity-80">{stop.labelEn}</span>
              </span>
            </div>
          );
        }

        const cleared = island.completionPercent >= 100;
        const isCurrent = i === firstActive;
        return (
          <Link
            key={i}
            data-testid="voyage-stop-link"
            href={`/play/${childId}/week/${island.weekId}`}
            aria-label={`${stop.labelEn} — week ${num}${cleared ? ' cleared' : isCurrent ? ' current' : ''}`}
            style={{ ...style, viewTransitionName: `island-${island.weekId}` }}
            className="absolute flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className="relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-[#caa24a] bg-gradient-to-b from-[#fbeec3] to-[#e9c877] text-[clamp(2.2rem,13vw,4.5rem)] shadow-xl">
              {stop.emoji}
              {/* Gold number badge */}
              <span className="absolute -left-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#fbeec3] bg-[#b8232a] text-base font-extrabold text-white shadow-md">
                {num}
              </span>
              {cleared && (
                <span
                  data-testid="voyage-stop-cleared"
                  className="absolute bottom-0 right-0 text-3xl drop-shadow"
                  aria-hidden="true"
                >
                  🏴
                </span>
              )}
              {isCurrent && (
                <span className="absolute bottom-0 right-0 text-3xl drop-shadow" aria-hidden="true">
                  ⛵
                </span>
              )}
              {isCurrent && !reduced && (
                <span className="absolute inset-0 animate-ping rounded-full bg-[#caa24a]/40" />
              )}
            </span>
            <span className="mt-1 rounded-md bg-black/45 px-2 py-0.5 text-center text-xs font-bold leading-tight text-white">
              {stop.labelZh}
              <span className="block text-[10px] font-medium opacity-85">{stop.labelEn}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
