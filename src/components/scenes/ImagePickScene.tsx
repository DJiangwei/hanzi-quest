'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  imageHook: string | null;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function ImagePickScene({ target, pool, onComplete, hintRequested }: Props) {
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

  return (
    <MultipleChoiceQuiz
      prompt="看图找字 / Find the character"
      stimulus={
        <div className="flex h-44 w-72 items-center justify-center rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 text-center text-base text-amber-900 shadow-sm">
          {target.imageHook ?? '（暂无图像描述）/ (no image yet)'}
        </div>
      }
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
      postRevealAudio={target.hanzi}
    />
  );
}
