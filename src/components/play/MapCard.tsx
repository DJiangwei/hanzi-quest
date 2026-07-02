'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { switchMapAction } from '@/lib/actions/maps';
import { getMapAccent } from '@/lib/play/map-boards';
import type { MapForChild } from '@/lib/db/maps';

interface Props {
  childId: string;
  map: MapForChild;
}

export function MapCard({ childId, map }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (map.isLocked || map.isCurrent || pending) return;
    setPending(true);
    try {
      await switchMapAction(childId, map.packId);
      router.push(`/play/${childId}`);
    } finally {
      setPending(false);
    }
  }

  const switchable = !map.isCurrent && !map.isLocked;
  const accent = getMapAccent(map.slug);

  return (
    <button
      type="button"
      data-testid="map-card"
      onClick={onClick}
      style={switchable ? { borderColor: accent.cardBorder } : undefined}
      className={
        'relative flex w-full flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-transform ' +
        (map.isCurrent
          ? 'border-[var(--color-treasure-400)] bg-white ring-2 ring-[var(--color-treasure-300)]'
          : map.isLocked
            ? 'border-[var(--color-sand-200)] bg-[var(--color-sand-50)] opacity-60'
            : 'bg-white active:scale-[0.98]')
      }
      disabled={map.isLocked || map.isCurrent || pending}
      aria-label={`${map.nameEn} map${map.isLocked ? ', locked' : map.isCurrent ? ', current' : ''}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-hanzi text-xl font-extrabold text-[var(--color-ocean-900)]">
          {map.nameZh}
        </h2>
        <span className="text-sm font-bold text-[var(--color-sand-700)]">
          {map.nameEn}
        </span>
      </div>
      {map.isCurrent && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-treasure-400)] px-2 py-0.5 text-xs font-bold text-[var(--color-treasure-800)]">
          👉 你正在这里 / You&apos;re here
        </span>
      )}
      {map.gated ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-sand-200)] px-2 py-0.5 text-xs font-bold text-[var(--color-sand-700)]">
          🔒 先击败上一片海域的霸主 / Defeat the previous overlord first
        </span>
      ) : (
        map.isLocked && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-sand-200)] px-2 py-0.5 text-xs font-bold text-[var(--color-sand-700)]">
            🔒 即将开放 / Coming soon
          </span>
        )
      )}
      {!map.isLocked && (
        <p className="text-xs text-[var(--color-sand-700)]">
          {map.weekCount} 周 · {map.weekCount} week{map.weekCount === 1 ? '' : 's'}
        </p>
      )}
    </button>
  );
}
