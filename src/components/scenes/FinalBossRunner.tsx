'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FinalBossScene } from './FinalBossScene';
import { CardChestReveal } from './fx/CardChestReveal';
import { TrophyToast } from '@/components/play/TrophyToast';
import { BonusToast } from '@/components/play/BonusToast';
import { finishFinalBossAction } from '@/lib/actions/final-boss';
import type { FinalBossQuestion } from '@/lib/play/final-boss';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { GrantedTrophy } from '@/lib/db/trophies';
import type { EconomyBonus } from '@/lib/actions/play';

interface Props {
  childId: string;
  packSlug: string;
  mapNameZh: string;
  mapNameEn: string;
  phases: FinalBossQuestion[][];
}

/**
 * Runs the FinalBossScene; on victory calls finishFinalBossAction and surfaces
 * the champion reveal (card), the trophy toast, and the 存钱罐 £3 bonus. When
 * nothing is granted (a repeat clear), bounces back home after the scene's own
 * victory beat.
 *
 * The £ toast matters here: the overlord is beaten once per map and pays the
 * largest single amount in the feature, so crediting it silently would be the
 * one win the child never hears about.
 */
export function FinalBossRunner({ childId, packSlug, mapNameZh, mapNameEn, phases }: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<RevealCard[]>([]);
  const [trophies, setTrophies] = useState<GrantedTrophy[]>([]);
  const [bonuses, setBonuses] = useState<EconomyBonus[]>([]);
  const [done, setDone] = useState(false);
  const [, start] = useTransition();

  const onComplete = (won: boolean) => {
    if (!won) return;
    start(async () => {
      const res = await finishFinalBossAction({ childId, packSlug });
      setCards(res.cardGrants);
      setTrophies(res.trophies);
      setBonuses(res.bonuses);
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
      <BonusToast bonuses={bonuses} onDone={() => setBonuses([])} />
    </>
  );
}
