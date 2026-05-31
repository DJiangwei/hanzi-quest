'use client';

import { useMemo } from 'react';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import { shuffle } from '@/lib/scenes/sample';

interface WordOption {
  wordId: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
  imageUrl: string | null;
}

interface BaseChar {
  characterId: string;
  hanzi: string;
}

interface Props {
  baseChar: BaseChar;
  correctWord: WordOption;
  distractors: WordOption[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function ImageWordScene({ correctWord, distractors, onComplete, hintRequested }: Props) {
  const choices = useMemo(
    () =>
      shuffle([correctWord, ...distractors]).map((w) => ({
        key: w.wordId,
        label: <span className="text-3xl font-extrabold">{w.text}</span>,
        isCorrect: w.wordId === correctWord.wordId,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [correctWord.wordId, distractors],
  );

  const stimulusText = correctWord.imageHook ?? correctWord.meaningEn ?? correctWord.text;

  const stimulus = correctWord.imageUrl ? (
    <div className="h-48 w-72 overflow-hidden rounded-2xl border-4 border-amber-800/30 bg-amber-50 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={correctWord.imageUrl}
        alt={stimulusText}
        className="h-full w-full object-cover"
        loading="eager"
      />
    </div>
  ) : (
    <div className="flex h-48 w-72 items-center justify-center rounded-2xl border-4 border-amber-800/30 bg-gradient-to-br from-amber-50 via-sky-50 to-amber-50 p-5 text-center shadow-lg">
      <span className="mr-2 shrink-0 text-3xl" aria-hidden>
        ✨
      </span>
      <p className="text-base font-semibold leading-snug text-amber-950">
        {stimulusText}
      </p>
    </div>
  );

  return (
    <MultipleChoiceQuiz
      prompt="看图选词 / Match the picture to a word"
      stimulus={stimulus}
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
    />
  );
}
