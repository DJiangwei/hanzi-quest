'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { EconomyBonus } from '@/lib/actions/play';

interface BonusToastProps {
  bonuses: EconomyBonus[];
  /** ms each toast stays visible before fading out. */
  durationMs?: number;
  onDone?: () => void;
}

const REASON_ICON: Record<EconomyBonus['reason'], string> = {
  daily_login: '🌞',
  streak_milestone: '🔥',
  perfect_week: '🏆',
};

/**
 * Renders a stack of "+N for X" toasts in the top-center of the screen.
 * One toast per bonus, each persists `durationMs` then fades. When the last
 * fades, calls `onDone`.
 *
 * Yinuo is English-native — every toast renders the Chinese label and the
 * English label side-by-side. No language toggle.
 */
export function BonusToast({
  bonuses,
  durationMs = 2400,
  onDone,
}: BonusToastProps) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (bonuses.length === 0) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [bonuses, durationMs, onDone]);

  if (bonuses.length === 0 || !visible) return null;

  return (
    <div
      data-testid="bonus-toast-stack"
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2"
      aria-live="polite"
    >
      {bonuses.map((b, i) => (
        <div
          key={`${b.reason}-${i}`}
          data-testid={`bonus-toast-${b.reason}`}
          data-reason={b.reason}
          style={{
            animationDelay: reduced ? '0ms' : `${i * 120}ms`,
          }}
          className={[
            'flex items-center gap-2 rounded-full border-2 border-amber-300',
            'bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-2',
            'text-sm shadow-lg shadow-amber-200/50',
            reduced ? '' : 'animate-bonus-pop',
          ].join(' ')}
        >
          <span className="text-xl" aria-hidden="true">
            {REASON_ICON[b.reason]}
          </span>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-hanzi text-stone-900">
              {b.labelZh}{' '}
              <span className="font-bold text-amber-700">+{b.delta}</span>
            </span>
            <span className="text-[10px] italic text-stone-600">
              {b.labelEn}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
