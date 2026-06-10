'use client';

import Link from 'next/link';
import { getVoyageMap, type VoyageStop } from '@/lib/play/map-boards';
import {
  voyageLayout,
  voyageLayoutHorizontal,
  type VoyagePoint,
} from '@/lib/play/voyage-layout';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { useIsWide } from '@/lib/hooks/use-is-wide';
import { PARCHMENT_BG, WAVE_BAND_H, WAVE_BAND_V } from '@/lib/play/voyage-textures';
import { VoyageBackdrop } from './VoyageBackdrop';
import { SailingShip } from './SailingShip';

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

/** Vertical room per stop, in px, for the tall phone board. */
const STOP_GAP_PX = 210;

export function VoyageBoard({ childId, packSlug, islands }: Props) {
  const map = getVoyageMap(packSlug);
  const reduced = useReducedMotion();
  const wide = useIsWide();
  if (!map) return null;

  const n = map.stops.length;
  const pos = wide ? voyageLayoutHorizontal(n) : voyageLayout(n);
  const firstActive = islands.findIndex((i) => i.completionPercent < 100);
  const currentIndex = firstActive < 0 ? Math.max(n - 1, 0) : firstActive;

  return (
    <div
      data-testid="voyage-board"
      data-layout={wide ? 'landscape' : 'vertical'}
      style={{
        backgroundImage: PARCHMENT_BG,
        ...(wide ? {} : { height: n * STOP_GAP_PX }),
      }}
      className={[
        'relative mx-auto w-full overflow-hidden rounded-[28px] border-[10px] border-[#caa24a] p-3 shadow-2xl ring-4 ring-[#7a4a14]/30',
        wide ? 'aspect-[16/10] max-w-5xl' : 'max-w-xl',
      ].join(' ')}
    >
      {/* Sea panel (inset inside the wave border) — holds the backdrop */}
      <div className="absolute inset-[30px] overflow-hidden rounded-xl border border-[#1f6e76]">
        <VoyageBackdrop imageUrl={map.imageUrl} />
      </div>

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

      {/* Title ribbon — sticky on the tall phone board, pinned on the landscape board */}
      <div
        className={[
          'z-30 mx-auto w-fit rounded-full border-2 border-[#caa24a] bg-[#f3e4c0] px-5 py-1.5 text-base font-extrabold text-[#7a4a14] shadow-md',
          wide ? 'absolute left-1/2 top-4 -translate-x-1/2' : 'sticky top-3',
        ].join(' ')}
      >
        {map.nameZh} · {map.nameEn}
      </div>

      {/* Dotted route */}
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
      {map.stops.map((stop, i) => (
        <StopNode
          key={i}
          stop={stop}
          num={i + 1}
          pos={pos[i]}
          island={islands[i]}
          isCurrent={i === firstActive}
          childId={childId}
          reduced={reduced}
          compact={wide}
        />
      ))}

      {/* Sailing ship overlay (matches the medallion coordinate space) */}
      <SailingShip points={pos} currentIndex={currentIndex} />
    </div>
  );
}

function StopNode({
  stop,
  num,
  pos,
  island,
  isCurrent,
  childId,
  reduced,
  compact,
}: {
  stop: VoyageStop;
  num: number;
  pos: VoyagePoint;
  island: VoyageBoardIsland | undefined;
  isCurrent: boolean;
  childId: string;
  reduced: boolean;
  compact: boolean;
}) {
  const style = { left: `${pos.xPct}%`, top: `${pos.yPct}%` } as const;
  // Landscape packs many stops across the width, so medallions are smaller.
  const widthClass = compact ? 'w-[13%]' : 'w-[42%]';
  const emojiClass = compact
    ? 'text-[clamp(1.4rem,4.5vw,3rem)]'
    : 'text-[clamp(2.2rem,13vw,4.5rem)]';

  if (!island) {
    return (
      <div
        data-testid="voyage-stop-locked"
        className={`absolute z-10 flex ${widthClass} -translate-x-1/2 -translate-y-1/2 flex-col items-center`}
        style={style}
        aria-label={`${stop.labelEn} — locked`}
      >
        <span className={`relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-[#8a6a3a] bg-[#cdbb95] ${emojiClass} opacity-60 shadow-lg`}>
          {stop.emoji}
          <span className="absolute bottom-1 right-1 text-xl">🔒</span>
        </span>
        <span className="mt-1 rounded-md bg-black/40 px-2 py-0.5 text-center text-[11px] font-semibold leading-tight text-white">
          {stop.labelZh}
          <span className="block text-[9px] opacity-80">{stop.labelEn}</span>
        </span>
      </div>
    );
  }

  const cleared = island.completionPercent >= 100;
  return (
    <Link
      data-testid="voyage-stop-link"
      href={`/play/${childId}/week/${island.weekId}`}
      aria-label={`${stop.labelEn} — week ${num}${cleared ? ' cleared' : isCurrent ? ' current' : ''}`}
      style={{ ...style, viewTransitionName: `island-${island.weekId}` }}
      className={`absolute z-10 flex ${widthClass} -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
    >
      <span className={`relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-[#caa24a] bg-gradient-to-b from-[#fbeec3] to-[#e9c877] ${emojiClass} shadow-xl`}>
        {stop.emoji}
        <span className="absolute -left-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#fbeec3] bg-[#b8232a] text-base font-extrabold text-white shadow-md">
          {num}
        </span>
        {cleared && (
          <span data-testid="voyage-stop-cleared" className="absolute bottom-0 right-0 text-2xl drop-shadow" aria-hidden="true">
            🏴
          </span>
        )}
        {isCurrent && (
          <span className="absolute bottom-0 right-0 text-2xl drop-shadow" aria-hidden="true">
            ⛵
          </span>
        )}
        {isCurrent && !reduced && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#caa24a]/40" />
        )}
      </span>
      <span className="mt-1 rounded-md bg-black/45 px-2 py-0.5 text-center text-[11px] font-bold leading-tight text-white">
        {stop.labelZh}
        <span className="block text-[9px] font-medium opacity-85">{stop.labelEn}</span>
      </span>
    </Link>
  );
}
