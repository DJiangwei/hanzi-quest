'use client';

import { type ReactNode, useState } from 'react';

interface Choice {
  key: string;
  label: ReactNode;
  isCorrect: boolean;
}

interface Props {
  prompt: ReactNode;
  stimulus: ReactNode;
  choices: Choice[];
  onComplete: (correct: boolean) => void;
}

export function MultipleChoiceQuiz({
  prompt,
  stimulus,
  choices,
  onComplete,
}: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);

  const handlePick = (key: string, isCorrect: boolean) => {
    if (revealed) return;
    setRevealed(key);
    setTimeout(() => onComplete(isCorrect), 750);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">
      {prompt ? (
        <p className="text-center text-base text-zinc-600">{prompt}</p>
      ) : null}
      <div className="flex items-center justify-center">{stimulus}</div>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {choices.map((c) => {
          const state =
            revealed === null
              ? 'idle'
              : c.key === revealed
                ? c.isCorrect
                  ? 'correct'
                  : 'wrong'
                : c.isCorrect
                  ? 'reveal-correct'
                  : 'dim';
          return (
            <button
              key={c.key}
              type="button"
              disabled={revealed !== null}
              onClick={() => handlePick(c.key, c.isCorrect)}
              className={[
                'rounded-2xl border-2 px-4 py-6 text-3xl font-bold transition-transform active:scale-95',
                state === 'idle' && 'border-zinc-200 bg-white hover:border-zinc-400',
                state === 'correct' && 'border-emerald-500 bg-emerald-100 text-emerald-900',
                state === 'wrong' && 'border-red-500 bg-red-100 text-red-900',
                state === 'reveal-correct' && 'border-emerald-300 bg-emerald-50',
                state === 'dim' && 'border-zinc-100 bg-zinc-50 text-zinc-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
