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

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

export function AudioPickScene({ target, pool, onComplete }: Props) {
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
      prompt="听一听，选出对的字"
      stimulus={
        <button
          type="button"
          onClick={() => speak(target.hanzi)}
          className="flex h-32 w-32 items-center justify-center rounded-full bg-sky-200 text-5xl shadow-lg transition-transform active:scale-95 hover:bg-sky-300"
          aria-label="Play audio"
        >
          🔊
        </button>
      }
      choices={choices}
      onComplete={onComplete}
    />
  );
}
