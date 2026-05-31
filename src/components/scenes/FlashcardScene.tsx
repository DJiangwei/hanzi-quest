// src/components/scenes/FlashcardScene.tsx
'use client';

import { useState } from 'react';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { SpeakButton } from '@/components/play/SpeakButton';
import { useSpeak } from '@/lib/hooks/useSpeak';

interface FlashcardSceneData {
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  firstSentence: string | null;
}

interface Props {
  data: FlashcardSceneData;
  onComplete: () => void;
}

export function FlashcardScene({ data, onComplete }: Props) {
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
          onClick={() => speak(data.hanzi)}
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
              onClick={() => speak(data.hanzi)}
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

        <WoodSignButton size="lg" onClick={onComplete}>
          Got it →
        </WoodSignButton>
      </div>
    </TreasureMapBackdrop>
  );
}
