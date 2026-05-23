'use client';

import { useEffect } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { GrantedTrophy } from '@/lib/actions/play';

interface Props {
  trophies: GrantedTrophy[];
  durationMs?: number;
  onDone?: () => void;
}

export function TrophyToast({ trophies, durationMs = 3500, onDone }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (trophies.length === 0) return;
    const t = setTimeout(() => onDone?.(), durationMs);
    return () => clearTimeout(t);
  }, [trophies, durationMs, onDone]);

  if (trophies.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2"
      aria-live="polite"
    >
      {trophies.map((t) => (
        <div
          key={t.slug}
          className={`flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 px-5 py-3 shadow-lg ${reduced ? '' : 'animate-bonus-pop'}`}
        >
          <span className="text-4xl" aria-hidden>
            {t.emoji}
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-amber-900/80">
              荣誉解锁 / Trophy Unlocked
            </span>
            <span className="text-base font-extrabold text-amber-950">{t.nameZh}</span>
            <span className="text-sm font-semibold text-amber-900">{t.nameEn}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
