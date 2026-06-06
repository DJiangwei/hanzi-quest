'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Props {
  gained: number;
  leveledUp: boolean;
  level: number;
  onDone: () => void;
  /** ms the toast stays visible before auto-dismissing. */
  durationMs?: number;
}

/**
 * Toast shown after a scene attempt when XP is gained.
 * Auto-dismisses after `durationMs` and calls `onDone`.
 * Renders null when `gained <= 0 && !leveledUp`.
 * Respects prefers-reduced-motion.
 */
export function XpGainToast({
  gained,
  leveledUp,
  level,
  onDone,
  durationMs = 2000,
}: Props) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);

  const hasContent = gained > 0 || leveledUp;

  useEffect(() => {
    if (!hasContent) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [hasContent, durationMs, onDone]);

  if (!hasContent || !visible) return null;

  return (
    <div
      data-testid="xp-gain-toast"
      className="pointer-events-none fixed inset-x-0 top-28 z-50 flex flex-col items-center gap-2"
      aria-live="polite"
    >
      {gained > 0 && (
        <div
          data-testid="xp-gained-label"
          className={[
            'flex items-center gap-2 rounded-full border-2 border-[var(--color-ocean-400)]',
            'bg-gradient-to-r from-[var(--color-ocean-100)] to-[var(--color-ocean-200)] px-4 py-2',
            'text-sm font-bold text-[var(--color-ocean-900)] shadow-lg',
            reduced ? '' : 'animate-bonus-pop',
          ].join(' ')}
        >
          <span aria-hidden="true">✨</span>
          <span>+{gained} XP</span>
        </div>
      )}
      {leveledUp && (
        <div
          data-testid="xp-level-up-label"
          className={[
            'flex items-center gap-2 rounded-full border-2 border-[var(--color-treasure-400)]',
            'bg-gradient-to-r from-amber-100 to-yellow-100 px-5 py-2.5',
            'text-base font-extrabold text-[var(--color-treasure-800)] shadow-lg',
            reduced ? '' : 'animate-bonus-pop',
          ].join(' ')}
        >
          <span aria-hidden="true">⚓</span>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-hanzi text-sm">升级！/ Level up!</span>
            <span className="text-xs font-bold">Lv {level}</span>
          </div>
        </div>
      )}
    </div>
  );
}
