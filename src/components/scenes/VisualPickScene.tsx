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
}

const joinPinyin = (p: string[]) => p.join('');

export function VisualPickScene({ target, pool, onComplete }: Props) {
  const choices = useMemo(() => {
    const targetKey = joinPinyin(target.pinyinArray);
    const distractorChars = sampleDistractors(
      pool.filter((p) => joinPinyin(p.pinyinArray) !== targetKey),
      target,
      3,
      (a, b) => a.characterId === b.characterId,
    );
    return shuffle([target, ...distractorChars]).map((c) => ({
      key: c.characterId,
      label: (
        <span className="text-2xl tracking-wider">{joinPinyin(c.pinyinArray)}</span>
      ),
      isCorrect: c.characterId === target.characterId,
    }));
  }, [pool, target]);

  return (
    <MultipleChoiceQuiz
      prompt="它怎么读？"
      stimulus={
        <span className="text-[10rem] leading-none">{target.hanzi}</span>
      }
      choices={choices}
      onComplete={onComplete}
    />
  );
}
