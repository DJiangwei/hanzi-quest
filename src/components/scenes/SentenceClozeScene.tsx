'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import { useSpeak } from '@/lib/hooks/useSpeak';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  sentenceText: string;
  translationEn: string | null;
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

function blankOut(sentence: string, hanzi: string): string {
  return sentence.replace(hanzi, ' ____ ');
}

export function SentenceClozeScene({
  target,
  pool,
  sentenceText,
  translationEn,
  onComplete,
  hintRequested,
}: Props) {
  const speak = useSpeak();
  const choices = useMemo(() => {
    const distractors = sampleDistractors(
      pool,
      target,
      3,
      (a, b) => a.characterId === b.characterId,
    );
    return shuffle([target, ...distractors]).map((c) => ({
      key: c.characterId,
      label: <span className="text-5xl">{c.hanzi}</span>,
      isCorrect: c.characterId === target.characterId,
    }));
  }, [pool, target]);

  const blanked = blankOut(sentenceText, target.hanzi);

  const stimulus = (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => speak(sentenceText)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-200 text-3xl shadow-lg transition-transform active:scale-95 hover:bg-emerald-300"
        aria-label="Play sentence"
      >
        🔊
      </button>
      <div className="rounded-2xl bg-emerald-50 px-6 py-3 text-2xl font-semibold text-emerald-900 shadow">
        {blanked}
      </div>
      {translationEn && (
        <div className="text-sm italic text-emerald-700">{translationEn}</div>
      )}
    </div>
  );

  return (
    <MultipleChoiceQuiz
      prompt="听句子，填字 / Fill in the blank"
      stimulus={stimulus}
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
      postRevealAudio={sentenceText}
      postRevealHoldMs={2500}
    />
  );
}
