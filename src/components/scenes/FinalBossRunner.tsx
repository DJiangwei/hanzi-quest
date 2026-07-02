'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FinalBossScene } from './FinalBossScene';
import { CardChestReveal } from './fx/CardChestReveal';
import { TrophyToast } from '@/components/play/TrophyToast';
import { finishFinalBossAction } from '@/lib/actions/final-boss';
import type { FinalBossQuestion } from '@/lib/play/final-boss';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { GrantedTrophy } from '@/lib/db/trophies';

interface Props {
  childId: string;
  packSlug: string;
  mapNameZh: string;
  mapNameEn: string;
  phases: FinalBossQuestion[][];
}

/**
 * Runs the FinalBossScene; on victory calls finishFinalBossAction and surfaces
 * the champion reveal (card) + trophy toast. When nothing is granted (a repeat
 * clear), bounces back home after the scene's own victory beat.
 */
export function FinalBossRunner({ childId, packSlug, mapNameZh, mapNameEn, phases }: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<RevealCard[]>([]);
  const [trophies, setTrophies] = useState<GrantedTrophy[]>([]);
  const [done, setDone] = useState(false);
  const [, start] = useTransition();

  const onComplete = (won: boolean) => {
    if (!won) return;
    start(async () => {
      const res = await finishFinalBossAction({ childId, packSlug });
      setCards(res.cardGrants);
      setTrophies(res.trophies);
      setDone(true);
    });
  };

  // Repeat clear (nothing granted): bounce home after a short beat.
  useEffect(() => {
    if (!done || cards.length > 0) return;
    const t = setTimeout(() => router.push(`/play/${childId}`), 1500);
    return () => clearTimeout(t);
  }, [done, cards.length, router, childId]);

  return (
    <>
      <FinalBossScene
        packSlug={packSlug}
        mapNameZh={mapNameZh}
        mapNameEn={mapNameEn}
        phases={phases}
        onComplete={onComplete}
      />
      {cards.length > 0 ? (
        <CardChestReveal
          cards={cards}
          onDone={() => {
            setCards([]);
            router.push(`/play/${childId}`);
          }}
        />
      ) : null}
      <TrophyToast trophies={trophies} onDone={() => setTrophies([])} />
    </>
  );
}
