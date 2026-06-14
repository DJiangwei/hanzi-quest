'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import { useSpeak } from '@/lib/hooks/useSpeak';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  audioUrl?: string | null;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function AudioPickScene({ target, pool, onComplete, hintRequested }: Props) {
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

  return (
    <MultipleChoiceQuiz
      prompt="听一听，选出对的字 / Listen and pick the character"
      stimulus={
        <button
          type="button"
          onClick={() => speak(target.hanzi, target.audioUrl)}
          className="flex h-32 w-32 items-center justify-center rounded-full bg-amber-200 text-5xl text-amber-900 shadow-lg transition-transform active:scale-95 hover:bg-amber-300"
          aria-label="Play audio"
        >
          🔊
        </button>
      }
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
    />
  );
}
