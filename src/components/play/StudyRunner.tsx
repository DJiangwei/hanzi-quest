'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { CardArt } from '@/components/play/items/CardArt';
import { SpeakButton } from '@/components/play/SpeakButton';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { finishStudyLessonAction, type StudyCardMessage } from '@/lib/actions/study';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { StudyQuestion, StudyCardLite } from '@/lib/play/study';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

interface Props {
  childId: string;
  packSlug: string;
  packNameZh: string;
  packNameEn: string;
  questions: StudyQuestion[];
}

export function StudyRunner({ childId, packSlug, packNameZh, packNameEn, questions }: Props) {
  const router = useRouter();
  const meta = getPackMeta(packSlug);
  const emojiFor = (slug: string) => meta?.resolveRevealEmoji?.(slug) ?? meta?.themeEmoji ?? '⭐';

  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [revealCards, setRevealCards] = useState<RevealCard[]>([]);
  const [cardMessage, setCardMessage] = useState<StudyCardMessage>(null);
  const [, startTransition] = useTransition();
  // Per-question answer telemetry — flushed with finishStudyLessonAction.
  const eventsRef = useRef<SceneAnswerEvent[]>([]);

  const q = questions[index];

  const onAnswer = (isCorrect: boolean) => {
    if (q) {
      eventsRef.current.push({
        sceneType: `study_${q.type}`,
        itemKey: q.target.slug,
        correct: isCorrect,
      });
    }
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(nextCorrect);
    const next = index + 1;
    if (next >= questions.length) {
      const score = Math.round((nextCorrect / questions.length) * 100);
      const events = eventsRef.current;
      eventsRef.current = [];
      startTransition(async () => {
        const res = await finishStudyLessonAction({ childId, packSlug, score, events });
        if (res.cardGrants.length) setRevealCards(res.cardGrants);
        if (res.cardMessage) setCardMessage(res.cardMessage);
        setDone(true);
      });
    } else {
      setIndex(next);
    }
  };

  if (done || !q) {
    const messageText =
      cardMessage === 'study_done_today'
        ? '今天这本图鉴已经学过啦 / Already studied this collection today'
        : cardMessage === 'daily_cap_reached'
          ? '今天的卡片已经发完啦,明天再来 / All cards earned for today — come back tomorrow'
          : null;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="font-hanzi text-2xl font-extrabold text-[var(--color-ocean-800)]">
          学习完成 <span className="text-lg font-semibold">/ Lesson complete</span>
        </h2>
        <p className="text-xs text-[var(--color-sand-700)]">
          {packNameZh} / {packNameEn}
        </p>
        <p className="font-hanzi text-base text-[var(--color-ocean-700)]">
          你答对了 {correct} / {questions.length} <span className="text-sm">· {correct}/{questions.length} correct</span>
        </p>
        {messageText && <p className="text-sm text-[var(--color-sand-700)]">{messageText}</p>}
        <WoodSignButton size="lg" onClick={() => router.push(`/play/${childId}/collection/${packSlug}`)}>
          返回 / Back
        </WoodSignButton>
        {revealCards.length > 0 ? (
          <CardChestReveal cards={revealCards} onDone={() => setRevealCards([])} />
        ) : null}
      </div>
    );
  }

  if (q.type === 'picture_to_word') {
    return (
      <MultipleChoiceQuiz
        key={q.id}
        prompt={<span className="font-hanzi text-lg">看图选词 / Match the picture to a word</span>}
        stimulus={<CardArt imageUrl={q.target.imageUrl} emoji={emojiFor(q.target.slug)} owned size="lg" alt={q.target.nameEn} />}
        choices={q.choices.map((c: StudyCardLite) => ({
          key: c.id,
          label: (
            <span className="flex flex-col items-center">
              <span className="font-hanzi text-2xl">{c.nameZh}</span>
              <span className="text-xs text-[var(--color-sand-600)]">{c.nameEn}</span>
            </span>
          ),
          isCorrect: c.id === q.target.id,
        }))}
        postRevealAudio={q.target.nameZh}
        onComplete={onAnswer}
      />
    );
  }

  // audio_to_picture
  return (
    <MultipleChoiceQuiz
      key={q.id}
      prompt={<span className="font-hanzi text-lg">听音选图 / Listen and pick the picture</span>}
      stimulus={<SpeakButton text={q.target.nameZh} size="md" label="🔊 听 / Listen" />}
      choices={q.choices.map((c: StudyCardLite) => ({
        key: c.id,
        label: <CardArt imageUrl={c.imageUrl} emoji={emojiFor(c.slug)} owned size="md" alt={c.nameEn} />,
        isCorrect: c.id === q.target.id,
      }))}
      onComplete={onAnswer}
    />
  );
}
