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

/** Aged-parchment paper texture (subtle speckles) as a CSS background. */
const PARCHMENT_BG =
  'radial-gradient(circle at 20% 30%, rgba(120,80,30,0.05) 0 2px, transparent 2px),' +
  'radial-gradient(circle at 70% 60%, rgba(120,80,30,0.05) 0 2px, transparent 2px),' +
  'radial-gradient(circle at 45% 85%, rgba(120,80,30,0.04) 0 2px, transparent 2px),' +
  'linear-gradient(160deg, #f3e4c0 0%, #e9d3a3 100%)';

/** Faint white wave linework over the sea (treasure-chart style). */
const SEA_WAVES =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Cpath d='M0 30 Q30 12 60 30 T120 30' fill='none' stroke='%23ffffff' stroke-width='2' opacity='0.12'/%3E%3Cpath d='M0 48 Q30 32 60 48 T120 48' fill='none' stroke='%23ffffff' stroke-width='2' opacity='0.10'/%3E%3C/svg%3E\")";

/** Teal scalloped wave band — the signature treasure-map border (repeats along an edge). */
const WAVE_BAND_H =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='26'%3E%3Crect width='48' height='26' fill='%232f8e96'/%3E%3Cpath d='M0 13 Q12 3 24 13 T48 13' fill='none' stroke='%23f3e4c0' stroke-width='3.5'/%3E%3Cpath d='M0 21 Q12 12 24 21 T48 21' fill='none' stroke='%23bfe3e6' stroke-width='2' opacity='0.7'/%3E%3C/svg%3E\")";
const WAVE_BAND_V =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='48'%3E%3Crect width='26' height='48' fill='%232f8e96'/%3E%3Cpath d='M13 0 Q3 12 13 24 T13 48' fill='none' stroke='%23f3e4c0' stroke-width='3.5'/%3E%3Cpath d='M21 0 Q12 12 21 24 T21 48' fill='none' stroke='%23bfe3e6' stroke-width='2' opacity='0.7'/%3E%3C/svg%3E\")";

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
      style={{ height: boardHeight, backgroundImage: PARCHMENT_BG }}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[28px] border-[10px] border-[#caa24a] p-3 shadow-2xl ring-4 ring-[#7a4a14]/30"
    >
      {/* Sea panel (inset inside the wave border) */}
      <div
        className="absolute inset-[30px] rounded-xl border border-[#1f6e76]"
        style={{ backgroundImage: SEA_WAVES + ',linear-gradient(180deg,#5cb3bb_0%,#2f8e96_50%,#1f6e76_100%)' }}
      />

      {/* Signature scalloped wave border, all four edges */}
      <div className="pointer-events-none absolute inset-2 z-10 rounded-lg">
        <div className="absolute left-0 right-0 top-0 h-[26px]" style={{ backgroundImage: WAVE_BAND_H, backgroundRepeat: 'repeat-x' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[26px] rotate-180" style={{ backgroundImage: WAVE_BAND_H, backgroundRepeat: 'repeat-x' }} />
        <div className="absolute bottom-0 left-0 top-0 w-[26px]" style={{ backgroundImage: WAVE_BAND_V, backgroundRepeat: 'repeat-y' }} />
        <div className="absolute bottom-0 right-0 top-0 w-[26px] rotate-180" style={{ backgroundImage: WAVE_BAND_V, backgroundRepeat: 'repeat-y' }} />
      </div>

      {/* Corner ornaments, treasure-map style */}
      <div className="pointer-events-none absolute left-1 top-1 z-20 text-2xl opacity-95 drop-shadow" aria-hidden="true">🐚</div>
      <div className="pointer-events-none absolute right-1 top-1 z-20 text-3xl opacity-95 drop-shadow" aria-hidden="true">🧭</div>
      <div className="pointer-events-none absolute bottom-1 left-1 z-20 text-2xl opacity-95 drop-shadow" aria-hidden="true">⚓</div>
      <div className="pointer-events-none absolute bottom-1 right-1 z-20 text-2xl opacity-95 drop-shadow" aria-hidden="true">⭐</div>

      {/* Title ribbon */}
      <div className="sticky top-3 z-30 mx-auto w-fit rounded-full border-2 border-[#caa24a] bg-[#f3e4c0] px-5 py-1.5 text-base font-extrabold text-[#7a4a14] shadow-md">
        {map.nameZh} · {map.nameEn}
      </div>

      {/* Dotted route — stretched over the full tall board */}
      <svg
        className="absolute inset-[30px] z-10 h-[calc(100%-60px)] w-[calc(100%-60px)]"
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
              stroke={done ? '#f0c14b' : '#f3e4c0'}
              strokeWidth="0.7"
              strokeDasharray="1.4 2.2"
              strokeLinecap="round"
              opacity={done ? 0.95 : 0.8}
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
              className="absolute z-10 flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
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
            className="absolute z-10 flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
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
