'use client';

import { useState } from 'react';
import { claimFestivalRewardAction } from '@/lib/actions/festival';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import type { RevealCard } from '@/lib/play/reveal-card';

interface Props {
  childId: string;
  yyyymm: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  blurbZh: string;
  blurbEn: string;
  activeDays: number;
  threshold: number;
  claimed: boolean;
  eligible: boolean;
}

/**
 * This month's festival challenge: a festival theme + an active-days progress
 * bar. When the goal is met the kid claims the festival card (revealed via the
 * shared chest). Bilingual chrome per the locked rule.
 */
export function FestivalChallengePanel({
  childId,
  yyyymm,
  nameZh,
  nameEn,
  emoji,
  blurbZh,
  blurbEn,
  activeDays,
  threshold,
  claimed: claimedInitial,
  eligible,
}: Props) {
  const [claimed, setClaimed] = useState(claimedInitial);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<RevealCard[]>([]);

  const pct = Math.min(100, Math.round((activeDays / threshold) * 100));
  const remaining = Math.max(0, threshold - activeDays);
  const canClaim = eligible && !claimed && !busy;

  async function onClaim() {
    setBusy(true);
    try {
      const res = await claimFestivalRewardAction(childId, yyyymm);
      if (res.granted) {
        setClaimed(true);
        setReveal([res.card]);
      } else if (res.reason === 'already_claimed') {
        setClaimed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-rose-300 bg-gradient-to-b from-rose-50 to-amber-50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden="true">
          {emoji}
        </span>
        <div className="min-w-0">
          <div className="font-hanzi text-lg font-bold leading-tight text-rose-900">
            本月挑战 · {nameZh}
          </div>
          <div className="text-xs font-semibold text-rose-700">
            This Month&apos;s Challenge · {nameEn}
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm leading-snug text-stone-700">
        <span className="font-hanzi">{blurbZh}</span>
        <span className="block text-xs italic text-stone-500">{blurbEn}</span>
      </p>

      {/* Active-days progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-stone-700">
          <span className="font-hanzi">
            活跃天数 / Active days
          </span>
          <span>
            {activeDays} / {threshold} 天 days
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200">
          <div
            data-testid="festival-progress-fill"
            className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center">
        {claimed ? (
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
            已领取 ✓ / Claimed
          </span>
        ) : canClaim ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={busy}
            className="rounded-full bg-rose-500 px-6 py-2 text-sm font-bold text-white shadow-md active:scale-95 disabled:opacity-60"
          >
            🎁 领取奖励 / Claim reward
          </button>
        ) : (
          <span className="rounded-full bg-stone-100 px-4 py-2 text-center text-xs font-semibold text-stone-500">
            再玩 {remaining} 天就能领奖啦 / {remaining} more day
            {remaining === 1 ? '' : 's'} to unlock
          </span>
        )}
      </div>

      {reveal.length > 0 && (
        <CardChestReveal cards={reveal} onDone={() => setReveal([])} />
      )}
    </div>
  );
}
