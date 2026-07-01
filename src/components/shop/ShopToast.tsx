'use client';

import { useEffect } from 'react';
import type { ShopFeedback, ShopFeedbackKind } from '@/lib/hooks/use-shop-purchase';

interface Props {
  feedback: ShopFeedback | null;
  onDone: () => void;
  /** Auto-dismiss delay in ms. */
  durationMs?: number;
}

interface Style {
  message: string;
  className: string;
}

const STYLES: Record<ShopFeedbackKind, Style> = {
  success: {
    message: '✅ 已购买 / Purchased!',
    className: 'border-emerald-400 bg-emerald-100 text-emerald-900',
  },
  owned: {
    message: '👍 你已经拥有了 / You already own this',
    className: 'border-amber-400 bg-amber-100 text-amber-900',
  },
  insufficient: {
    message: '🪙 金币不够啦 / Not enough coins',
    className: 'border-amber-400 bg-amber-100 text-amber-900',
  },
  error: {
    message: '购买失败 / Purchase failed',
    className: 'border-red-400 bg-red-100 text-red-900',
  },
};

/**
 * Fixed, bottom-center, auto-dismissing toast for shop purchase feedback.
 * Positive on success, friendly (not scary-red) for already-owned / not-enough,
 * red only for a true failure. Bilingual per the repo's chrome rule.
 */
export function ShopToast({ feedback, onDone, durationMs = 2000 }: Props) {
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [feedback, durationMs, onDone]);

  if (!feedback) return null;

  const style = STYLES[feedback.kind];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="shop-toast"
      data-kind={feedback.kind}
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4"
    >
      <div
        className={`rounded-2xl border-2 px-5 py-3 text-sm font-extrabold shadow-lg ${style.className}`}
      >
        {style.message}
      </div>
    </div>
  );
}
