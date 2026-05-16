// src/components/scenes/fx/LevelFanfare.tsx
'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useEffect, useState, useTransition } from 'react';
import { AlreadyClaimedError, pullFreeFromBoss } from '@/lib/actions/gacha';
import { playSound } from '@/lib/audio/play';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { PullResult } from '@/lib/db/gacha';
import type { ZodiacSlug } from '@/components/play/zodiac-icons';
import { TreasureChestReveal } from './TreasureChestReveal';

interface Props {
  weekLabel: string;
  coinsThisSession: number;
  childId: string;
  weekId: string;
  chestAvailable: boolean;
  onContinue: () => void;
}

export function LevelFanfare({
  weekLabel,
  coinsThisSession,
  childId,
  weekId,
  chestAvailable,
  onContinue,
}: Props) {
  const reduced = useReducedMotion();
  const [pullResult, setPullResult] = useState<PullResult | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pulling, startPullTransition] = useTransition();

  useEffect(() => {
    if (!reduced) playSound('fanfare');
  }, [reduced]);

  const openChest = () => {
    startPullTransition(async () => {
      try {
        const result = await pullFreeFromBoss(weekId, { childId });
        setPullResult(result);
      } catch (e) {
        if (e instanceof AlreadyClaimedError) {
          setPullError('宝箱已经开过啦');
        } else {
          setPullError('开宝箱失败，回地图再试');
        }
      }
    });
  };

  if (pullResult) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8">
        <TreasureChestReveal
          item={{
            id: pullResult.item.id,
            slug: pullResult.item.slug as ZodiacSlug,
            nameZh: pullResult.item.nameZh,
            nameEn: pullResult.item.nameEn,
            loreZh: pullResult.item.loreZh,
            loreEn: pullResult.item.loreEn,
          }}
          wasDuplicate={pullResult.wasDuplicate}
          shardsAfter={pullResult.shardsAfter}
        />
        <WoodSignButton size="lg" onClick={onContinue}>
          回地图
        </WoodSignButton>
      </main>
    );
  }

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
      <div className="flex flex-col gap-3">
        {chestAvailable && (
          <WoodSignButton size="lg" onClick={openChest} disabled={pulling}>
            {pulling ? '开启中…' : '开启宝箱 🎁'}
          </WoodSignButton>
        )}
        <WoodSignButton
          size={chestAvailable ? 'md' : 'lg'}
          variant={chestAvailable ? 'ghost' : 'primary'}
          onClick={onContinue}
        >
          回地图
        </WoodSignButton>
      </div>
      {pullError && <p className="text-sm text-[var(--color-bad)]">{pullError}</p>}
    </main>
  );
}
