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

export function VoyageBoard({ childId, packSlug, islands }: Props) {
  const map = getVoyageMap(packSlug);
  const reduced = useReducedMotion();
  if (!map) return null;

  const pos = voyageLayout(map.stops.length);
  const firstActive = islands.findIndex((i) => i.completionPercent < 100);

  return (
    <div
      data-testid="voyage-board"
      className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border-4 border-[#b8895a] bg-[radial-gradient(ellipse_at_center,#3f9aa3_0%,#1f6b73_70%,#16545b_100%)] shadow-lg"
    >
      {/* Parchment frame trim */}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[#e8d6a8]/40" />
      {/* Title banner */}
      <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-[#e8d6a8] px-4 py-1 text-sm font-extrabold text-[#7a4a14] shadow">
        {map.nameZh} · {map.nameEn}
      </div>
      {/* Compass rose */}
      <div className="absolute right-2 top-2 z-10 text-2xl opacity-80" aria-hidden="true">🧭</div>

      {/* Dotted route */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {pos.slice(0, -1).map((a, i) => {
          const b = pos[i + 1];
          return (
            <line
              key={i}
              x1={a.xPct} y1={a.yPct} x2={b.xPct} y2={b.yPct}
              stroke="#e8d6a8" strokeWidth="0.6" strokeDasharray="2 2" strokeLinecap="round"
              opacity="0.8"
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
              className="absolute flex w-[13%] min-w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={style}
              aria-label={`${stop.labelEn} — locked`}
            >
              <span className="relative flex aspect-square w-full items-center justify-center rounded-full border-4 border-[#8a6a3a] bg-[#cdbb95] text-2xl opacity-60 shadow-inner">
                {stop.emoji}
                <span className="absolute -bottom-1 -right-1 text-base">🔒</span>
              </span>
              <span className="mt-0.5 rounded bg-black/35 px-1 text-[9px] font-semibold leading-tight text-white">
                {stop.labelEn}
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
            className="absolute flex w-[13%] min-w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className="relative flex aspect-square w-full items-center justify-center rounded-full border-4 border-[#caa24a] bg-gradient-to-b from-[#fbeec3] to-[#e9c877] text-2xl shadow-md">
              {stop.emoji}
              {/* Gold number badge */}
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#b8232a] text-[11px] font-extrabold text-white shadow">
                {num}
              </span>
              {cleared && (
                <span data-testid="voyage-stop-cleared" className="absolute -bottom-1 -right-1 text-lg" aria-hidden="true">🏴</span>
              )}
              {isCurrent && (
                <span className="absolute -bottom-1 -right-1 text-lg" aria-hidden="true">⛵</span>
              )}
              {isCurrent && !reduced && (
                <span className="absolute inset-0 animate-ping rounded-full bg-[#caa24a]/40" />
              )}
            </span>
            <span className="mt-0.5 rounded bg-black/45 px-1 text-[9px] font-semibold leading-tight text-white">
              {stop.labelEn}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
