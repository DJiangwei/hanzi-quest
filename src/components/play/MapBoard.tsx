'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getMapBoard } from '@/lib/play/map-boards';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

export interface MapBoardIsland {
  weekId: string;
  completionPercent: number;
}

interface Props {
  childId: string;
  /** Pack slug — resolved to a config client-side (never pass the config object across RSC). */
  packSlug: string;
  /** Ordered by weekNumber; islands[i] occupies hotspots[i]. */
  islands: MapBoardIsland[];
}

export function MapBoard({ childId, packSlug, islands }: Props) {
  const board = getMapBoard(packSlug);
  const reduced = useReducedMotion();
  if (!board) return null;

  const firstActive = islands.findIndex((i) => i.completionPercent < 100);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-2xl shadow-md">
      <Image
        src={board.imageSrc}
        alt={`${board.nameZh} / ${board.nameEn}`}
        fill
        priority
        sizes="(max-width: 768px) 100vw, 672px"
        className="object-cover"
      />
      {board.hotspots.map((h, i) => {
        const island = islands[i];
        const style = { left: `${h.xPct}%`, top: `${h.yPct}%` };
        if (!island) {
          return (
            <div
              key={i}
              data-testid="map-hotspot-locked"
              className="absolute flex h-[14%] min-h-11 w-[14%] min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={style}
              aria-label={`${h.labelEn} — locked`}
            >
              <span className="rounded-full bg-black/45 px-1.5 py-0.5 text-base leading-none">🔒</span>
            </div>
          );
        }
        const cleared = island.completionPercent >= 100;
        const isCurrent = i === firstActive;
        return (
          <Link
            key={i}
            data-testid="map-hotspot-link"
            href={`/play/${childId}/week/${island.weekId}`}
            aria-label={`${h.labelEn} — week ${i + 1}`}
            style={{ ...style, viewTransitionName: `island-${island.weekId}` }}
            className="absolute flex h-[14%] min-h-11 w-[14%] min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {isCurrent && !reduced && (
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-treasure-400)]/40" />
            )}
            {isCurrent && (
              <span className="absolute inset-0 rounded-full ring-2 ring-[var(--color-treasure-400)]" />
            )}
            {cleared && (
              <span
                data-testid="map-hotspot-cleared"
                className="absolute -right-1 -top-1 text-lg drop-shadow"
                aria-hidden="true"
              >
                🏴
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
