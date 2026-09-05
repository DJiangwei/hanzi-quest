// src/components/scenes/FlashcardScene.tsx
'use client';

import { useState } from 'react';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';
import { SpeakButton } from '@/components/play/SpeakButton';
import { useSpeak } from '@/lib/hooks/useSpeak';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

interface FlashcardSceneData {
  characterId: string;
  hanzi: string;
  hanziAudioUrl?: string | null;
  pinyin: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  firstWordAudioUrl?: string | null;
  firstSentence: string | null;
}

interface Props {
  data: FlashcardSceneData;
  onComplete: () => void;
  /** Telemetry: emits the kid's self-rating. Never affects scoring. */
  onAnswerEvent?: (e: SceneAnswerEvent) => void;
}

/**
 * Self-assessment options. ALL of them complete the scene as success —
 * review is exposure, not a test; honesty is never punished. The rating
 * only feeds the answer_events telemetry (write-only, for future review
 * weighting + parent insights).
 *
 * **Styled identically, on purpose.** These were emerald / amber / rose, and
 * in this game green means correct and red means wrong everywhere else — so
 * admitting she did not know a character meant pressing a failure button,
 * while the easy answer sat first and glowed green. Production bore it out:
 * every one of 164 self-ratings was `got_it`, across two months in which she
 * answered 33 scored questions wrong. The words distinguish these buttons
 * now; nothing about their appearance should.
 */
const RATING_BUTTON_CLS =
  'min-h-11 flex-1 rounded-xl border-2 border-[var(--color-ocean-300)] bg-[var(--color-ocean-100)] px-4 py-3 text-[var(--color-ocean-900)] shadow-sm transition-transform active:scale-95 hover:bg-[var(--color-ocean-200)]';

const RATINGS = [
  { rating: 'got_it', zh: '认识', en: 'Got it' },
  { rating: 'not_sure', zh: '不确定', en: 'Not sure' },
  { rating: 'dont_know', zh: '不认识', en: "Don't know" },
] as const;

export function FlashcardScene({ data, onComplete, onAnswerEvent }: Props) {
  const [pinyinShown, setPinyinShown] = useState(false);
  const [meaningShown, setMeaningShown] = useState(false);
  const [wordShown, setWordShown] = useState(false);
  const [sentenceShown, setSentenceShown] = useState(false);
  const speak = useSpeak();

  return (
    <TreasureMapBackdrop intensity="medium">
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <button
          type="button"
          onClick={() => speak(data.hanzi, data.hanziAudioUrl)}
          className="font-hanzi block select-none leading-none text-[clamp(8rem,42vw,16rem)] text-[var(--color-ocean-900)] transition-transform active:scale-95"
          aria-label={`Play audio for ${data.hanzi}`}
          style={{
            textShadow: '0 2px 0 rgba(255,250,225,0.5)',
          }}
        >
          {data.hanzi}
        </button>

        <div className="flex flex-col items-center gap-2">
          {pinyinShown ? (
            <button
              type="button"
              onClick={() => speak(data.hanzi, data.hanziAudioUrl)}
              className="text-3xl font-medium tracking-wider text-[var(--color-ocean-700)]"
            >
              {data.pinyin.join(' ')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPinyinShown(true)}
              className="rounded-full border-2 border-dashed border-[var(--color-ocean-300)] px-6 py-2 text-[var(--color-ocean-700)] hover:border-[var(--color-ocean-500)] hover:bg-[var(--color-ocean-100)]"
            >
              Tap to show pinyin
            </button>
          )}

          {meaningShown ? (
            <p className="text-xl text-[var(--color-sand-900)]">
              {data.meaningEn ?? '—'}
              {data.meaningZh ? (
                <span className="ml-2 text-base text-[var(--color-sand-700)]">
                  · {data.meaningZh}
                </span>
              ) : null}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setMeaningShown(true)}
              className="text-sm text-[var(--color-sand-700)] hover:text-[var(--color-sand-900)]"
            >
              Tap to show meaning
            </button>
          )}

          {data.firstWord ? (
            wordShown ? (
              <div className="flex items-center gap-2">
                <span className="font-hanzi text-3xl text-[var(--color-ocean-800)]">
                  {data.firstWord}
                </span>
                <SpeakButton
                  text={data.firstWord}
                  audioUrl={data.firstWordAudioUrl}
                  size="sm"
                  label={`Read aloud ${data.firstWord}`}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setWordShown(true)}
                className="rounded-full border-2 border-dashed border-[var(--color-ocean-300)] px-5 py-1.5 text-sm text-[var(--color-ocean-700)] hover:bg-[var(--color-ocean-100)]"
              >
                Tap to show example word / 例词
              </button>
            )
          ) : null}

          {data.firstSentence ? (
            sentenceShown ? (
              <div className="flex flex-col items-center gap-2 px-2">
                <p className="font-hanzi text-xl text-[var(--color-ocean-800)] text-center">
                  {data.firstSentence}
                </p>
                <SpeakButton
                  text={data.firstSentence}
                  size="sm"
                  label="Read aloud sentence"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSentenceShown(true)}
                className="rounded-full border-2 border-dashed border-[var(--color-ocean-300)] px-5 py-1.5 text-sm text-[var(--color-ocean-700)] hover:bg-[var(--color-ocean-100)]"
              >
                Tap to show sentence / 例句
              </button>
            )
          ) : null}
        </div>

        <div className="flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {RATINGS.map(({ rating, zh, en }) => (
            <button
              key={rating}
              type="button"
              onClick={() => {
                onAnswerEvent?.({
                  sceneType: 'flashcard',
                  characterId: data.characterId,
                  selfRating: rating,
                  // Behaviour, not a claim: uncovering the pinyin or the
                  // meaning is something she DID, so it cannot be flattered
                  // the way a self-rating can. The example word and sentence
                  // are shown ALONGSIDE the character rather than instead of
                  // recognising it, so they are far less diagnostic and are
                  // deliberately left out.
                  revealed: pinyinShown || meaningShown,
                });
                onComplete();
              }}
              className={RATING_BUTTON_CLS}
            >
              <span className="font-hanzi text-lg">{zh}</span>
              <span className="ml-1 text-sm opacity-80">/ {en}</span>
            </button>
          ))}
        </div>
      </div>
    </TreasureMapBackdrop>
  );
}
