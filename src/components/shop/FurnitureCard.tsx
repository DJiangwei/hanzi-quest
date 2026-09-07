'use client';

import type { ReactNode } from 'react';

/**
 * One tappable item in the furniture shop.
 *
 * **The whole card is the button.** The previous design put a paragraph beside
 * a small picture and a button underneath whose label was a sentence — `再买一个
 * / Buy another 🪙 320`. That is a lot of reading for a six-year-old to do
 * twenty-five times, and it printed the price twice: once in the row and again
 * inside the button.
 *
 * So: the picture is the card, the name sits under it, and the price is a coin
 * chip. Tapping anywhere buys. Nothing here says more than it needs to —
 * footprint ("1×1 格 / cells") was developer information and is gone.
 *
 * **The unaffordable state is quiet, not scolding.** A greyed chip, never "you
 * can't afford this". This product softens 畏难情绪 everywhere else, and a shop
 * is exactly where a child meets the word "no" most often.
 */

export type CardState = 'buy' | 'tooExpensive' | 'maxed' | 'owned' | 'unavailable';

export function FurnitureCard({
  preview,
  nameZh,
  nameEn,
  priceCoins,
  rarity,
  state,
  ownedCount = 0,
  pending,
  onBuy,
  testId,
}: {
  preview: ReactNode;
  nameZh: string;
  nameEn: string;
  priceCoins: number;
  rarity: 'common' | 'rare' | 'epic';
  state: CardState;
  ownedCount?: number;
  pending: boolean;
  onBuy: () => void;
  testId: string;
}) {
  const tappable = state === 'buy' && !pending;

  return (
    <button
      type="button"
      data-testid={testId}
      data-state={state}
      disabled={!tappable}
      onClick={onBuy}
      aria-label={`${nameZh} ${nameEn}${
        state === 'buy'
          ? ` — ${priceCoins} 金币 / ${priceCoins} coins`
          : state === 'maxed'
            ? ' — 已满 / max owned'
            : state === 'owned'
              ? ' — 已拥有 / owned'
              : state === 'tooExpensive'
                ? ` — ${priceCoins} 金币，还差一点 / not enough coins yet`
                : ' — 即将上线 / coming soon'
      }`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition ${
        tappable
          ? 'border-amber-200 shadow-sm active:scale-[0.97] hover:border-amber-400'
          : 'border-stone-200 opacity-70'
      }`}
    >
      {/* Picture first, and big. */}
      <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-amber-50 to-amber-100/70 p-2">
        {preview}
        {rarity !== 'common' && (
          <span
            className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-px text-[9px] font-bold ${
              rarity === 'epic' ? 'bg-purple-200 text-purple-900' : 'bg-amber-300 text-amber-900'
            }`}
          >
            {rarity === 'epic' ? '★★★' : '★★'}
          </span>
        )}
        {ownedCount > 0 && (
          <span
            data-testid={`owned-count-${testId}`}
            className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-px text-[10px] font-extrabold text-white shadow"
          >
            ×{ownedCount}
          </span>
        )}
      </div>

      {/* Fixed height so every card in a row lines up — names vary from two to
          five characters and a content-height footer made the grid ragged. */}
      <div className="flex h-11 items-center justify-between gap-1 px-2">
        <span className="min-w-0">
          <span className="font-hanzi block truncate text-[13px] font-bold leading-tight text-stone-800">
            {nameZh}
          </span>
          <span className="block truncate text-[10px] leading-tight text-stone-500">{nameEn}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${
            state === 'buy'
              ? 'bg-amber-300 text-amber-900'
              : state === 'maxed' || state === 'owned'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-100 text-stone-400'
          }`}
        >
          {state === 'maxed' ? '满' : state === 'owned' ? '✓' : `🪙${priceCoins}`}
        </span>
      </div>
    </button>
  );
}
