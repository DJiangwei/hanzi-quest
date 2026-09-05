'use client';

import Link from 'next/link';
import { hanziNumber } from '@/lib/i18n/hanzi-number';
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
  /** T1: 🏴 means the BOSS is beaten, not merely "some section reached 100%". */
  bossCleared: boolean;
  /** T3: published but still 🔒 — its predecessor's boss is unbeaten. */
  locked?: boolean;
}

interface Props {
  childId: string;
  /** Pack slug — resolved to a config client-side (never pass the config object across RSC). */
  packSlug: string;
  /** Ordered by weekNumber; islands[i] occupies stops[i]. */
  islands: VoyageBoardIsland[];
  /** When present, appends a final-boss lair node after the last stop. */
  finalBoss?: { unlocked: boolean; cleared: boolean };
}

/** Vertical room per stop, in px, for the tall phone board. */
const STOP_GAP_PX = 210;

export function VoyageBoard({ childId, packSlug, islands, finalBoss }: Props) {
  const map = getVoyageMap(packSlug);
  const reduced = useReducedMotion();
  const wide = useIsWide();
  if (!map) return null;

  const n = map.stops.length;
  const slots = finalBoss ? n + 1 : n;
  const pos = wide ? voyageLayoutHorizontal(slots) : voyageLayout(slots);
  // Current ⛵ = the FRONTIER: first island whose boss is unbeaten (T1). It
  // carries the ✨2× double-treasure badge.
  const firstActive = islands.findIndex((i) => !i.bossCleared);
  const currentIndex = firstActive < 0 ? Math.max(n - 1, 0) : firstActive;

  return (
    <div
      data-testid="voyage-board"
      data-layout={wide ? 'landscape' : 'vertical'}
      style={{
        backgroundImage: PARCHMENT_BG,
        ...(wide ? {} : { height: slots * STOP_GAP_PX }),
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

      {/* Final-boss lair node, appended after the last stop */}
      {finalBoss && (
        <FinalBossNode
          childId={childId}
          packSlug={packSlug}
          pos={pos[n]}
          finalBoss={finalBoss}
          compact={wide}
        />
      )}

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

  // Two distinct locked states share this medallion: `!island` = no such week
  // is published yet, and `island.locked` = published but gated behind the
  // previous island's boss (T3). Only the latter gets the "beat the boss
  // before it" explanation — for an unpublished stop there's nothing to do.
  const gated = Boolean(island?.locked);
  if (!island || gated) {
    return (
      <div
        data-testid={gated ? 'voyage-stop-gated' : 'voyage-stop-locked'}
        className={`absolute z-10 flex ${widthClass} -translate-x-1/2 -translate-y-1/2 flex-col items-center`}
        style={style}
        aria-label={
          gated
            ? `${stop.labelEn} — locked, beat the previous island's boss first`
            : `${stop.labelEn} — locked`
        }
      >
        <span className={`relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-[#8a6a3a] bg-[#cdbb95] ${emojiClass} opacity-60 shadow-lg`}>
          {stop.emoji}
          <span className="absolute bottom-1 right-1 text-xl">🔒</span>
        </span>
        <span className="mt-1 rounded-md bg-black/40 px-2 py-0.5 text-center text-[11px] font-semibold leading-tight text-white">
          {stop.labelZh}
          <span className="block text-[9px] opacity-80">{stop.labelEn}</span>
          {gated && (
            <span className="mt-0.5 block text-[9px] font-bold text-amber-200">
              打通上一关 Boss 解锁
              <span className="block font-medium opacity-90">Beat the boss before it</span>
            </span>
          )}
        </span>
      </div>
    );
  }

  const cleared = island.bossCleared;
  return (
    <Link
      data-testid="voyage-stop-link"
      href={`/play/${childId}/week/${island.weekId}`}
      aria-label={`${stop.labelEn} — week ${num}${cleared ? ' cleared' : isCurrent ? ' current — 双倍宝藏 double treasure' : ''}`}
      style={{ ...style, viewTransitionName: `island-${island.weekId}` }}
      className={`absolute z-10 flex ${widthClass} -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
    >
      <span className={`relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] border-[#caa24a] bg-gradient-to-b from-[#fbeec3] to-[#e9c877] ${emojiClass} shadow-xl`}>
        {stop.emoji}
        {/* The week number in hanzi. Every stop on every visit, all year — the
            cheapest re-exposure to 一…十 in the product. 1–10 are all single
            glyphs, so the medallion never has to shrink; the guard is for a
            future map longer than ten weeks. */}
        <span
          data-testid="voyage-stop-number"
          className={`font-hanzi absolute -left-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#fbeec3] bg-[#b8232a] font-extrabold text-white shadow-md ${
            hanziNumber(num).length > 1 ? 'text-[11px]' : 'text-lg'
          }`}
        >
          {hanziNumber(num)}
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
        {isCurrent && (
          <span
            data-testid="frontier-badge"
            className={`absolute -right-2 -top-2 rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-400 to-amber-600 px-1.5 py-0.5 text-xs font-extrabold text-white shadow-md ${reduced ? '' : 'animate-pulse'}`}
            aria-hidden="true"
          >
            ✨2×
          </span>
        )}
        {isCurrent && !reduced && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#caa24a]/40" />
        )}
      </span>
      <span className="mt-1 rounded-md bg-black/45 px-2 py-0.5 text-center text-[11px] font-bold leading-tight text-white">
        {stop.labelZh}
        <span className="block text-[9px] font-medium opacity-85">{stop.labelEn}</span>
        {/* T3: name the first-clear prize on the board itself, so the reward is
            visible BEFORE the fight rather than only after it. */}
        {isCurrent && (
          <span
            data-testid="frontier-reward-hint"
            className="mt-0.5 block text-[9px] font-extrabold text-amber-200"
          >
            首通 Boss：🪙×2 🎴+1 🗝️+1
            <span className="block font-semibold opacity-90">
              First boss win: 2× coins, +1 card, +1 key
            </span>
          </span>
        )}
      </span>
    </Link>
  );
}

function FinalBossNode({
  childId,
  packSlug,
  pos,
  finalBoss,
  compact,
}: {
  childId: string;
  packSlug: string;
  pos: VoyagePoint;
  finalBoss: { unlocked: boolean; cleared: boolean };
  compact: boolean;
}) {
  const state = finalBoss.cleared ? 'cleared' : finalBoss.unlocked ? 'ready' : 'locked';
  const emoji = state === 'cleared' ? '👑' : state === 'ready' ? '⚔️' : '🔒';
  const style = { left: `${pos.xPct}%`, top: `${pos.yPct}%` } as const;
  const widthClass = compact ? 'w-[13%]' : 'w-[42%]';
  const emojiClass = compact
    ? 'text-[clamp(1.4rem,4.5vw,3rem)]'
    : 'text-[clamp(2.2rem,13vw,4.5rem)]';

  const medallion = (
    <span
      className={`relative flex aspect-square w-full items-center justify-center rounded-full border-[5px] ${emojiClass} shadow-xl ${
        state === 'locked'
          ? 'border-[#8a6a3a] bg-[#cdbb95] opacity-60'
          : 'border-[#b8232a] bg-gradient-to-b from-[#f7c8ca] to-[#b8232a]'
      }`}
    >
      {emoji}
    </span>
  );
  const label = (
    <span className="mt-1 rounded-md bg-black/45 px-2 py-0.5 text-center text-[11px] font-bold leading-tight text-white">
      终极霸主
      <span className="block text-[9px] font-medium opacity-85">Final Overlord</span>
    </span>
  );
  const wrapperClass = `absolute z-10 flex ${widthClass} -translate-x-1/2 -translate-y-1/2 flex-col items-center`;

  if (finalBoss.unlocked) {
    return (
      <div data-testid="final-boss-node" data-state={state} className={wrapperClass} style={style}>
        <Link
          href={`/play/${childId}/final-boss/${packSlug}`}
          aria-label="Final Overlord"
          className="flex w-full flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {medallion}
          {label}
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="final-boss-node"
      data-state={state}
      className={wrapperClass}
      style={style}
      aria-label="Final Overlord — locked"
    >
      {medallion}
      {label}
    </div>
  );
}
