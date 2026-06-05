'use client';

import { getPackMeta } from '@/lib/collections/packRegistry';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

export interface GiftPackRevealCard {
  itemId: string;
  packSlug: string;
  isDupe: boolean;
  shardsAfter: number;
}

export interface GiftPackRevealProps {
  cards: GiftPackRevealCard[];
  onClose: () => void;
}

export function GiftPackReveal({ cards, onClose }: GiftPackRevealProps) {
  const reduced = useReducedMotion();

  if (cards.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={[
          'flex flex-col items-center gap-5 rounded-3xl bg-white px-8 py-8 shadow-2xl',
          reduced ? '' : 'animate-bonus-pop',
        ]
          .join(' ')
          .trim()}
      >
        {/* Banner */}
        <div className="text-center">
          <p className="text-4xl" aria-hidden="true">🎁</p>
          <h2 className="font-hanzi text-2xl font-bold text-amber-900">大礼包</h2>
          <p className="text-sm text-amber-700">Weekly Gift</p>
        </div>

        {/* Card tiles */}
        <div className="flex flex-wrap justify-center gap-4">
          {cards.map((card) => {
            const emoji = getPackMeta(card.packSlug)?.themeEmoji ?? '🎴';
            return (
              <div
                key={card.itemId}
                data-testid="gift-card-tile"
                className="flex flex-col items-center gap-1 rounded-2xl bg-amber-50 px-5 py-4 shadow"
              >
                <span className="text-5xl" aria-hidden="true">{emoji}</span>
                {card.isDupe && (
                  <span className="text-xs font-semibold text-sky-700">
                    +1 🔹 碎片 / shard
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Collect button */}
        <button
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] rounded-2xl bg-amber-500 px-8 py-3 text-lg font-bold text-white shadow active:scale-95"
          aria-label="领取 / Collect"
        >
          领取 / Collect
        </button>
      </div>
    </div>
  );
}
