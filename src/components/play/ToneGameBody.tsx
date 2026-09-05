'use client';

import { useMemo, useState } from 'react';
import { useSpeak } from '@/lib/hooks/useSpeak';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { buildToneQuestions, type ToneChar } from '@/lib/tones/minimal-pairs';

/** Questions in one round. Short on purpose — this is a warm-up, not a test. */
const ROUND_SIZE = 8;

interface Props {
  chars: ToneChar[];
}

/**
 * 听声调 — hear a character, pick which one it was.
 *
 * **Why the speaker is given the HANZI, never the pinyin.** The device reads a
 * character with its correct tone by construction; a pinyin string would be
 * read as letters. This is the whole reason the game is buildable at all — the
 * pre-generated MeloTTS clips were scrapped precisely because their tones were
 * wrong, and nothing here re-introduces a recording anyone has to trust.
 *
 * **No score, no streak, no rewards.** This version exists so the tone premise
 * can be TESTED on a real device: if 妈 and 马 sound alike through the iPad's
 * voice, the game is teaching nothing and should be deleted rather than
 * decorated. Wiring an economy into an unverified premise would mean a
 * migration for a feature that might not survive its first play.
 */
export function ToneGameBody({ chars }: Props) {
  const speak = useSpeak();
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  // Re-rolled per round, so a second go is a different set.
  const questions = useMemo(
    () => buildToneQuestions(chars, ROUND_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chars, round],
  );
  const q = questions[index];

  const shuffled = useMemo(
    () => (q ? [...q.choices].sort(() => Math.random() - 0.5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q?.id],
  );

  if (questions.length === 0) {
    return (
      <p
        data-testid="tone-empty"
        className="rounded-3xl border-2 border-dashed border-sky-300 bg-white/70 p-6 text-center text-sm text-sky-900"
      >
        <span className="font-hanzi block">再多学几个字，就能玩听声调啦!</span>
        <span className="mt-1 block italic text-sky-900/70">
          Learn a few more characters and this game unlocks.
        </span>
      </p>
    );
  }

  if (!q) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center" data-testid="tone-done">
        <div className="text-6xl">🎧</div>
        <h2 className="font-hanzi text-2xl font-extrabold text-[var(--color-ocean-800)]">
          听完啦！<span className="text-lg font-semibold">/ Round complete</span>
        </h2>
        <WoodSignButton
          size="lg"
          onClick={() => {
            setRound((r) => r + 1);
            setIndex(0);
            setPicked(null);
          }}
        >
          再来一轮 / Play again
        </WoodSignButton>
      </div>
    );
  }

  const answered = picked !== null;

  return (
    <div className="flex w-full flex-col items-center gap-6" data-testid="tone-game">
      <p className="text-xs text-[var(--color-sand-700)]">
        <span className="font-hanzi">听声调</span>{' '}
        <span className="italic">/ Listen</span> — {index + 1}/{questions.length}
      </p>

      <button
        type="button"
        data-testid="tone-play"
        onClick={() => speak(q.answer.hanzi)}
        className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[var(--color-ocean-300)] bg-[var(--color-ocean-100)] text-5xl shadow-md transition-transform active:scale-95"
        aria-label="再听一次 / Play the sound again"
      >
        🔊
      </button>
      <p className="text-sm text-[var(--color-sand-700)]">
        <span className="font-hanzi">这是哪个字?</span>{' '}
        <span className="italic">/ Which character was that?</span>
      </p>

      <ul className="grid w-full max-w-md grid-cols-2 gap-3">
        {shuffled.map((choice) => {
          const isAnswer = choice.hanzi === q.answer.hanzi;
          // After answering, the RIGHT one is marked — the wrong one she picked
          // is only dimmed, never crossed or reddened. Getting a tone wrong is
          // the expected state of learning tones.
          const state = !answered
            ? 'border-[var(--color-ocean-300)] bg-white/90'
            : isAnswer
              ? 'border-[var(--color-ocean-500)] bg-[var(--color-ocean-100)]'
              : 'border-stone-200 bg-white/60 opacity-60';
          return (
            <li key={choice.characterId}>
              <button
                type="button"
                data-testid={`tone-choice-${choice.hanzi}`}
                disabled={answered}
                onClick={() => {
                  setPicked(choice.hanzi);
                  speak(choice.hanzi);
                }}
                className={`w-full rounded-2xl border-2 py-5 transition ${state}`}
              >
                <span className="font-hanzi text-4xl text-[var(--color-ocean-900)]">
                  {choice.hanzi}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <WoodSignButton
          size="lg"
          onClick={() => {
            setIndex((i) => i + 1);
            setPicked(null);
          }}
        >
          下一个 / Next
        </WoodSignButton>
      ) : null}
    </div>
  );
}
