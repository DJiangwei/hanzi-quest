'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CoinShower } from './fx/CoinShower';
import { ShakeWrap } from './fx/ShakeWrap';
import { playSound } from '@/lib/audio/play';
import { useCoinHud } from '@/lib/hooks/coin-hud-context';

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
  const [triggerKey, setTriggerKey] = useState(0);
  const [tappedRect, setTappedRect] = useState<DOMRect | null>(null);
  const [showCoins, setShowCoins] = useState(false);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  });
  const { coinHudRef } = useCoinHud();

  const handlePick = (
    key: string,
    isCorrect: boolean,
    el: HTMLButtonElement,
  ) => {
    if (revealed) return;
    setRevealed(key);
    setTappedRect(el.getBoundingClientRect());
    if (isCorrect) {
      setShowCoins(true);
      playSound('ding');
    } else {
      setTriggerKey((k) => k + 1);
      playSound('buzz');
    }
    setTimeout(() => completeRef.current(isCorrect), 750);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">
      {prompt ? (
        <p className="font-hanzi text-center text-lg text-[var(--color-ocean-700)]">
          {prompt}
        </p>
      ) : null}
      <div className="flex items-center justify-center">{stimulus}</div>
      <ShakeWrap triggerKey={triggerKey}>
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
                onClick={(e) => handlePick(c.key, c.isCorrect, e.currentTarget)}
                className={[
                  'rounded-2xl border-2 px-4 py-6 text-3xl font-bold shadow-sm transition-transform active:scale-95',
                  state === 'idle' &&
                    'border-[var(--color-sand-200)] bg-white text-[var(--color-ocean-900)] hover:border-[var(--color-ocean-300)] hover:bg-[var(--color-ocean-100)]',
                  state === 'correct' &&
                    'border-[var(--color-good)] bg-[var(--color-good-bg)] text-[var(--color-ocean-900)]',
                  state === 'wrong' &&
                    'border-[var(--color-bad)] bg-[var(--color-bad-bg)] text-[var(--color-ocean-900)]',
                  state === 'reveal-correct' &&
                    'border-[var(--color-good)] bg-[var(--color-good-bg)]/60',
                  state === 'dim' &&
                    'border-[var(--color-sand-200)] bg-[var(--color-sand-100)] text-[var(--color-sand-700)]',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </ShakeWrap>
      {showCoins && (
        <CoinShower
          count={5}
          targetEl={coinHudRef}
          originRect={tappedRect}
          onComplete={() => setShowCoins(false)}
        />
      )}
    </div>
  );
}
