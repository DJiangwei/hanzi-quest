'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CoinShower } from './fx/CoinShower';
import { ShakeWrap } from './fx/ShakeWrap';
import { playSound } from '@/lib/audio/play';
import { useCoinHud } from '@/lib/hooks/coin-hud-context';
import { useSpeak } from '@/lib/hooks/useSpeak';

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
  hintRequested?: boolean;
  /**
   * zh-CN text to auto-speak once when the answer is revealed (right or wrong).
   * Used by scenes whose stimulus IS the answer surface (Image/Visual/Image-word
   * /Sentence-cloze) — they can't safely speak the stimulus pre-pick because
   * the choices are hanzi/pinyin and speaking would reveal the answer. Post-
   * reveal speech is the safe moment to pronounce the correct content.
   */
  postRevealAudio?: string;
  /** Pre-recorded clip for `postRevealAudio`; preferred over TTS when present. */
  postRevealAudioUrl?: string | null;
  /**
   * Override the default 750ms auto-advance delay after reveal. Used by
   * SentenceClozeScene so the full sentence playback (~2-3s) isn't cut off.
   */
  postRevealHoldMs?: number;
}

export function MultipleChoiceQuiz({
  prompt,
  stimulus,
  choices,
  onComplete,
  hintRequested,
  postRevealAudio,
  postRevealAudioUrl,
  postRevealHoldMs,
}: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [triggerKey, setTriggerKey] = useState(0);
  const [tappedRect, setTappedRect] = useState<DOMRect | null>(null);
  const [showCoins, setShowCoins] = useState(false);
  const completeRef = useRef(onComplete);

  // When a hint is active, gray out the first wrong choice (deterministic, pure — no random in render).
  const grayedKey = hintRequested
    ? (choices.find((c) => !c.isCorrect)?.key ?? null)
    : null;
  useEffect(() => {
    completeRef.current = onComplete;
  });
  const { coinHudRef } = useCoinHud();
  const speak = useSpeak();

  const handlePick = (
    key: string,
    isCorrect: boolean,
    el: HTMLButtonElement,
  ) => {
    if (revealed || (grayedKey !== null && key === grayedKey)) return;
    setRevealed(key);
    setTappedRect(el.getBoundingClientRect());
    if (isCorrect) {
      setShowCoins(true);
      playSound('ding');
    } else {
      setTriggerKey((k) => k + 1);
      playSound('buzz');
    }
    if (postRevealAudio) {
      // Speak the correct content once on reveal. The kid's pick is the
      // user gesture that authorizes Web Speech; chained speak() inside the
      // click handler stays inside the gesture chain.
      speak(postRevealAudio, postRevealAudioUrl);
    }
    const holdMs = postRevealHoldMs ?? 750;
    setTimeout(() => completeRef.current(isCorrect), holdMs);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-12">
      {/* Left pane: prompt + stimulus (own column on lg) */}
      <div className="flex flex-col items-center justify-center gap-8">
        {prompt ? (
          <p className="font-hanzi text-center text-lg text-[var(--color-ocean-700)]">
            {prompt}
          </p>
        ) : null}
        <div className="flex items-center justify-center">{stimulus}</div>
      </div>
      {/* Right pane: answer choices */}
      <ShakeWrap triggerKey={triggerKey}>
        <div className="grid w-full max-w-md grid-cols-2 gap-3 lg:mx-auto lg:max-w-lg">
          {choices.map((c) => {
            const isGrayed = grayedKey !== null && c.key === grayedKey && revealed === null;
            const state =
              isGrayed
                ? 'dim'
                : revealed === null
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
                disabled={revealed !== null || isGrayed}
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
