// src/components/scenes/fx/LevelFanfare.tsx
'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useEffect } from 'react';
import { playSound } from '@/lib/audio/play';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

/** Bilingual copy for the "no card this time" notices (David, 2026-06-12). */
const CARD_MESSAGES: Record<string, { zh: string; en: string }> = {
  review_done_today: {
    zh: '今日回顾已完成，不再获得新卡片',
    en: "Today's review is done — no new card",
  },
  daily_cap_reached: {
    zh: '今日卡片已经发放完毕，明日再来',
    en: "All of today's cards are claimed — come back tomorrow",
  },
};

interface Props {
  weekLabel: string;
  coinsThisSession: number;
  childId: string;
  weekId: string;
  chestAvailable: boolean;
  /** When set, shows a bilingual "no card" notice (review-done / daily cap). */
  cardMessage?: 'review_done_today' | 'daily_cap_reached' | null;
  onContinue: () => void;
}

export function LevelFanfare({
  weekLabel,
  coinsThisSession,
  // childId and weekId are kept in Props for API stability (callers pass them)
  // but not needed in this component after the legacy chest button was removed
  chestAvailable,
  cardMessage,
  onContinue,
}: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!reduced) playSound('fanfare');
  }, [reduced]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative h-40 w-40">
        {reduced ? (
          <div className="flex h-full w-full items-center justify-center text-6xl" aria-hidden="true">
            🎉
          </div>
        ) : (
          <DotLottieReact
            data-testid="lottie"
            src="/animations/pirate-fanfare.json"
            autoplay
            loop={false}
            aria-label="celebration animation"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
      <h2 className="font-hanzi text-4xl font-bold text-[var(--color-ocean-900)]">
        {chestAvailable ? 'Boss defeated!' : 'Island cleared!'}
      </h2>
      <p className="text-lg text-[var(--color-sand-900)]">
        <span className="font-hanzi">{weekLabel}</span>
        <span className="mx-2 text-[var(--color-sand-700)]">·</span>
        <span className="font-semibold text-[var(--color-treasure-700)]">
          🪙 +{coinsThisSession}
        </span>
      </p>
      {cardMessage && CARD_MESSAGES[cardMessage] && (
        <p
          data-testid="card-message"
          className="max-w-xs rounded-2xl bg-[var(--color-sand-100)] px-4 py-2 text-sm font-semibold text-[var(--color-sand-800)]"
        >
          <span className="mr-1">🎴</span>
          {CARD_MESSAGES[cardMessage].zh}
          <span className="mx-1 text-[var(--color-sand-500)]">·</span>
          {CARD_MESSAGES[cardMessage].en}
        </p>
      )}
      <WoodSignButton size="lg" variant="primary" onClick={onContinue}>
        回地图 / Back to map
      </WoodSignButton>
    </main>
  );
}
