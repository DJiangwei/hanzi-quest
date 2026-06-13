'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';
import { SentenceOrderScene } from '@/components/scenes/SentenceOrderScene';
import { LevelFanfare } from '@/components/scenes/fx/LevelFanfare';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { finishHomeworkAction } from '@/lib/actions/homework';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { HomeworkItemConfig } from '@/lib/homework/schemas';

interface RunnerItem {
  id: string;
  type: HomeworkItemConfig['type'];
  config: HomeworkItemConfig;
}

interface Props {
  childId: string;
  weekId: string;
  weekLabel: string;
  items: RunnerItem[];
}

/**
 * Deterministic shuffle seeded by item id — pure (no Math.random in render).
 * Returns a permutation of indices [0..n-1].
 */
function seededOrder(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => ((a * 31 + seed) % n) - ((b * 31 + seed) % n),
  );
}

export function HomeworkRunner({ childId, weekId, weekLabel, items }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [revealCards, setRevealCards] = useState<RevealCard[]>([]);
  const [cardMessage, setCardMessage] = useState<
    'review_done_today' | 'daily_cap_reached' | 'homework_done_today' | null
  >(null);
  const [, startTransition] = useTransition();

  const item = items[index];

  const advance = () => {
    const next = index + 1;
    if (next >= items.length) {
      startTransition(async () => {
        const res = await finishHomeworkAction({ childId, weekId });
        if (res.cardGrants.length) setRevealCards(res.cardGrants);
        if (res.cardMessage) setCardMessage(res.cardMessage);
        setDone(true);
      });
    } else {
      setIndex(next);
    }
  };

  if (done || !item) {
    return (
      <>
        <LevelFanfare
          weekLabel={weekLabel}
          coinsThisSession={0}
          childId={childId}
          weekId={weekId}
          chestAvailable={false}
          cardMessage={cardMessage}
          onContinue={() => router.push(`/play/${childId}/week/${weekId}`)}
        />
        {revealCards.length > 0 ? (
          <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} />
        ) : null}
      </>
    );
  }

  if (item.config.type === 'sentence_order') {
    return (
      <SentenceOrderScene
        key={item.id}
        tokens={item.config.tokens}
        translationEn={item.config.translationEn ?? null}
        onComplete={advance}
      />
    );
  }

  if (item.config.type === 'char_quiz') {
    const cfg = item.config;
    const order = seededOrder(cfg.options.length, item.id.charCodeAt(0));
    const choices = order.map((i) => ({
      key: String(i),
      label: (
        <span className="flex flex-col items-center">
          <span className="font-hanzi text-xl">{cfg.options[i]!.textZh}</span>
          <span className="text-xs text-[var(--color-sand-600)]">{cfg.options[i]!.textEn}</span>
        </span>
      ),
      isCorrect: i === cfg.correctIndex,
    }));
    return (
      <MultipleChoiceQuiz
        key={item.id}
        prompt={<span className="font-hanzi text-lg">{cfg.questionZh}</span>}
        stimulus={cfg.hanzi ? <span className="font-hanzi text-7xl">{cfg.hanzi}</span> : null}
        choices={choices}
        onComplete={advance}
      />
    );
  }

  // word_building
  const cfg = item.config;
  const words = [cfg.correctWord, ...cfg.distractors];
  const order = seededOrder(words.length, item.id.charCodeAt(0));
  const choices = order.map((i) => ({
    key: String(i),
    label: <span className="font-hanzi text-2xl">{words[i]}</span>,
    isCorrect: i === 0,
  }));
  return (
    <MultipleChoiceQuiz
      key={item.id}
      prompt={
        <span className="font-hanzi text-lg">
          给「{cfg.baseChar}」组词 / Make a word
        </span>
      }
      stimulus={<span className="font-hanzi text-7xl">{cfg.baseChar}</span>}
      choices={choices}
      onComplete={advance}
    />
  );
}
