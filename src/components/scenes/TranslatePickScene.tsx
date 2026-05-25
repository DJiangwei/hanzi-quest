'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import type { TranslateDirection } from '@/lib/scenes/configs';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  meaningEn: string | null;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  direction: TranslateDirection;
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function TranslatePickScene({ target, pool, direction, onComplete, hintRequested }: Props) {
  const filteredPool = useMemo(
    () => pool.filter((c) => Boolean(c.meaningEn) && c.meaningEn !== target.meaningEn),
    [pool, target.meaningEn],
  );

  const choices = useMemo(() => {
    const distractors = sampleDistractors(
      filteredPool,
      target,
      3,
      (a, b) => a.characterId === b.characterId,
    );
    const all = shuffle([target, ...distractors]);
    return all.map((c) => ({
      key: c.characterId,
      label: (
        <span className={direction === 'cn_to_en' ? 'text-xl font-semibold' : 'text-5xl'}>
          {direction === 'cn_to_en' ? (c.meaningEn ?? '?') : c.hanzi}
        </span>
      ),
      isCorrect: c.characterId === target.characterId,
    }));
  }, [filteredPool, target, direction]);

  const stimulus =
    direction === 'cn_to_en' ? (
      <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-amber-100 text-7xl font-bold text-amber-900 shadow-lg">
        {target.hanzi}
      </div>
    ) : (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-amber-100 px-8 text-3xl font-bold text-amber-900 shadow-lg">
        {target.meaningEn ?? '?'}
      </div>
    );

  const prompt =
    direction === 'cn_to_en'
      ? '它是什么意思？/ What does this mean?'
      : '选出对应的汉字 / Pick the matching character';

  return (
    <MultipleChoiceQuiz
      prompt={prompt}
      stimulus={stimulus}
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
    />
  );
}
