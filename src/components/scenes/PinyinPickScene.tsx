'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function PinyinPickScene({ target, pool, onComplete, hintRequested }: Props) {
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

  const pinyin = target.pinyinArray.join(' ');

  return (
    <MultipleChoiceQuiz
      prompt="看拼音，选汉字 / Pick the character"
      stimulus={
        <div className="flex h-32 items-center justify-center rounded-2xl bg-sky-100 px-8 text-5xl font-bold tracking-wide text-sky-900 shadow-lg">
          {pinyin}
        </div>
      }
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
    />
  );
}
