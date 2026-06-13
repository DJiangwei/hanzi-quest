'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import {
  claimSeasonTierAction,
  claimAllSeasonTiersAction,
} from '@/lib/actions/season';
import type { SeasonView, SeasonViewTier } from '@/lib/season/view';
import type { RevealCard } from '@/lib/play/reveal-card';

function rewardLabel(reward: SeasonViewTier['reward']): {
  zh: string;
  en: string;
  icon: string;
} {
  switch (reward.type) {
    case 'coins':
      return { zh: `${reward.amount} 金币`, en: `${reward.amount} coins`, icon: '🪙' };
    case 'powerup':
      return reward.kind === 'skip'
        ? { zh: `跳过 ×${reward.count}`, en: `Skip ×${reward.count}`, icon: '⏭️' }
        : { zh: `护级 ×${reward.count}`, en: `Streak Freeze ×${reward.count}`, icon: '🧊' };
    case 'shards':
      return { zh: `碎片 ×${reward.amount}`, en: `Shards ×${reward.amount}`, icon: '🔹' };
    case 'card':
      return { zh: '赛季限定卡', en: 'Season card', icon: '🎴' };
    case 'cosmetic':
      return { zh: '赛季装扮', en: 'Season cosmetic', icon: '🎀' };
    case 'cosmetic_set':
      return { zh: '船长套装 + 徽章', en: 'Captain set + badge', icon: '🏆' };
  }
}

export function SeasonTrack({
  childId,
  view,
}: {
  childId: string;
  view: SeasonView;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [reveals, setReveals] = useState<RevealCard[]>([]);

  const anyClaimable = view.tiers.some((t) => t.state === 'claimable');

  function claim(tier: number) {
    startTransition(async () => {
      try {
        const res = await claimSeasonTierAction(childId, tier);
        if (res.reveals.length > 0) setReveals(res.reveals);
        else router.refresh();
      } catch {
        // swallow — claim fails gracefully
      }
    });
  }

  function claimAll() {
    startTransition(async () => {
      try {
        const res = await claimAllSeasonTiersAction(childId);
        if (res.reveals.length > 0) setReveals(res.reveals);
        else router.refresh();
      } catch {
        // swallow
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <header className="rounded-2xl border-2 border-teal-300 bg-gradient-to-r from-cyan-100 to-teal-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 font-hanzi text-lg font-bold text-teal-900">
            <span className="text-2xl" aria-hidden="true">
              {view.themeEmoji}
            </span>
            {view.nameZh} / {view.nameEn}
          </h1>
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-teal-800">
            Tier {view.currentTier}/{view.tiers.length}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-teal-700">
          {view.seasonXp} XP ·{' '}
          {view.xpToNext !== null
            ? `距下个奖励 还需 ${view.xpToNext} XP / to next reward`
            : '已满级 / Maxed out'}
          {' · '}
          {view.ended
            ? '赛季已结束 / Season ended'
            : `距赛季结束 ${view.daysRemaining} 天 / days left`}
        </p>
        {anyClaimable && (
          <button
            type="button"
            onClick={claimAll}
            disabled={pending}
            className="mt-2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-extrabold text-amber-900 shadow disabled:opacity-50"
          >
            一键领取 / Claim all
          </button>
        )}
      </header>

      {/* Tier rows */}
      <ol className="flex flex-col gap-2">
        {view.tiers.map((t) => {
          const label = rewardLabel(t.reward);
          return (
            <li
              key={t.tier}
              data-testid={`season-tier-${t.tier}`}
              data-state={t.state}
              className={[
                'flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5',
                t.state === 'claimed'
                  ? 'border-emerald-300 bg-emerald-50'
                  : t.state === 'claimable'
                    ? `border-amber-400 bg-amber-50 ${reduced ? '' : 'animate-bonus-pop'}`
                    : 'border-stone-200 bg-stone-50 opacity-70',
              ].join(' ')}
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-200 text-xs font-bold text-teal-900">
                  {t.tier}
                </span>
                <span className="text-xl" aria-hidden="true">
                  {label.icon}
                </span>
                <span className="font-hanzi text-sm font-semibold text-stone-800">
                  {label.zh} <span className="text-xs text-stone-500">/ {label.en}</span>
                </span>
              </span>
              {t.state === 'claimed' ? (
                <span className="text-xs font-bold text-emerald-700">✅ 已领 / Claimed</span>
              ) : t.state === 'claimable' ? (
                <button
                  type="button"
                  onClick={() => claim(t.tier)}
                  disabled={pending}
                  className="rounded-full bg-teal-500 px-3.5 py-1.5 text-sm font-bold text-white shadow disabled:opacity-50"
                >
                  领取 / Claim
                </button>
              ) : (
                <span className="text-sm" aria-hidden="true">
                  🔒
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {reveals.length > 0 && (
        <CardChestReveal
          cards={reveals}
          onDone={() => {
            setReveals([]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
