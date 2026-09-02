'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';
import { MidSceneFlag } from '@/components/play/MidSceneProvider';
import { SpeakButton } from '@/components/play/SpeakButton';
import { CardChestReveal } from '@/components/scenes/fx/CardChestReveal';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { finishReviewAction } from '@/lib/actions/review';
import type { ReviewPoolChar, ReviewQuestion } from '@/lib/review/session';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

interface Props {
  childId: string;
  questions: ReviewQuestion[];
  pool: ReviewPoolChar[];
}

/**
 * Runs a 温故 session over the real MultipleChoiceQuiz, exactly as StudyRunner
 * does. Accumulates telemetry in a ref and submits ONCE at the end.
 */
export function ReviewRunner({ childId, questions, pool }: Props) {
  const router = useRouter();
  const byId = new Map(pool.map((c) => [c.characterId, c]));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [cards, setCards] = useState<RevealCard[]>([]);
  const [done, setDone] = useState(false);
  const events = useRef<SceneAnswerEvent[]>([]);
  const [, start] = useTransition();

  const q = questions[index];

  function onAnswer(isCorrect: boolean) {
    if (q) {
      // SceneAnswerEventSchema requires EXACTLY one of correct/selfRating.
      // 温故 never collects a self-rating, so `correct` is always the one set.
      events.current.push({
        sceneType: q.type,
        characterId: q.targetCharacterId,
        correct: isCorrect,
      });
    }

    const nextCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(nextCorrect);
    const next = index + 1;
    if (next < questions.length) {
      setIndex(next);
      return;
    }

    const score = Math.round((nextCorrect / questions.length) * 100);
    const finalEvents = events.current;
    start(async () => {
      const res = await finishReviewAction({ childId, score, events: finalEvents });
      setCards(res.cardGrants);
      setDone(true);
    });
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-10">
        <h1 className="font-hanzi text-2xl font-extrabold">温故完成！</h1>
        <p className="italic text-[var(--color-sand-700)]">Review complete!</p>
        {cards.length > 0 ? (
          <CardChestReveal cards={cards} onDone={() => setCards([])} />
        ) : null}
        <WoodSignButton size="lg" onClick={() => router.push(`/play/${childId}`)}>
          回地图 / Back to the map
        </WoodSignButton>
      </main>
    );
  }

  if (!q) return null;

  const target = byId.get(q.targetCharacterId);
  if (!target) return null;

  const choices = q.choiceCharacterIds
    .map((id) => byId.get(id))
    .filter((c): c is ReviewPoolChar => Boolean(c));

  const progress = (
    <p className="text-xs text-[var(--color-sand-700)]">
      <span className="font-hanzi">温故</span>{' '}
      <span className="italic">/ Review</span> — {index + 1}/{questions.length}
    </p>
  );

  if (q.type === 'translate_pick') {
    return (
      <>
        <MidSceneFlag />
        {progress}
        <MultipleChoiceQuiz
          key={q.id}
          prompt={<span className="font-hanzi text-lg">这个字是什么意思？ / What does this mean?</span>}
          stimulus={<span className="font-hanzi text-6xl">{target.hanzi}</span>}
          choices={choices.map((c) => ({
            key: c.characterId,
            label: <span className="text-lg">{c.meaningEn}</span>,
            isCorrect: c.characterId === q.targetCharacterId,
          }))}
          postRevealAudio={target.hanzi}
          onComplete={onAnswer}
        />
      </>
    );
  }

  if (q.type === 'image_pick') {
    const word = target.words.find((w) => w.wordId === q.stimulusWordId);
    // A frozen stimulus whose word vanished from the pool is not renderable;
    // fall through to the audio question rather than showing a blank box.
    if (word?.imageUrl) {
      return (
        <>
          <MidSceneFlag />
          {progress}
          <MultipleChoiceQuiz
            key={q.id}
            prompt={<span className="font-hanzi text-lg">看图找字 / Find the character</span>}
            stimulus={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={word.imageUrl}
                alt={word.text}
                className="h-40 w-40 rounded-2xl object-cover"
              />
            }
            choices={choices.map((c) => ({
              key: c.characterId,
              label: <span className="font-hanzi text-4xl">{c.hanzi}</span>,
              isCorrect: c.characterId === q.targetCharacterId,
            }))}
            onComplete={onAnswer}
          />
        </>
      );
    }
  }

  // audio_pick, and image_pick's unresolved-stimulus fallback, both offer
  // HANZI choices, so the stimulus must not be the hanzi itself — speaking or
  // showing it would give the answer.
  //
  // Do NOT pass a hint: 💡 is practice-only, and the hint text describes the
  // picture in English, which would give the answer away here.
  return (
    <>
      <MidSceneFlag />
      {progress}
      <MultipleChoiceQuiz
        key={q.id}
        prompt={<span className="font-hanzi text-lg">听音选字 / Listen and pick the character</span>}
        stimulus={<SpeakButton text={target.hanzi} size="md" label="🔊 听 / Listen" />}
        choices={choices.map((c) => ({
          key: c.characterId,
          label: <span className="font-hanzi text-4xl">{c.hanzi}</span>,
          isCorrect: c.characterId === q.targetCharacterId,
        }))}
        onComplete={onAnswer}
      />
    </>
  );
}
