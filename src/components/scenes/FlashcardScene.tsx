'use client';

import { useState } from 'react';

interface FlashcardSceneData {
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
}

interface Props {
  data: FlashcardSceneData;
  onComplete: () => void;
}

function speak(text: string) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

export function FlashcardScene({ data, onComplete }: Props) {
  const [pinyinShown, setPinyinShown] = useState(false);
  const [meaningShown, setMeaningShown] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <button
        type="button"
        onClick={() => speak(data.hanzi)}
        className="select-none text-[14rem] leading-none transition-transform active:scale-95"
        aria-label={`Play audio for ${data.hanzi}`}
      >
        {data.hanzi}
      </button>

      <div className="flex flex-col items-center gap-2">
        {pinyinShown ? (
          <button
            type="button"
            onClick={() => speak(data.hanzi)}
            className="text-3xl font-medium tracking-wider text-zinc-700"
          >
            {data.pinyin.join(' ')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPinyinShown(true)}
            className="rounded-full border-2 border-dashed border-zinc-400 px-6 py-2 text-zinc-500 hover:border-zinc-600 hover:text-zinc-700"
          >
            Tap to show pinyin
          </button>
        )}

        {meaningShown ? (
          <p className="text-xl text-zinc-600">
            {data.meaningEn ?? '—'}
            {data.meaningZh ? (
              <span className="ml-2 text-base text-zinc-400">
                · {data.meaningZh}
              </span>
            ) : null}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setMeaningShown(true)}
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            Tap to show meaning
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="rounded-full bg-emerald-500 px-10 py-3 text-lg font-bold text-white shadow-lg hover:bg-emerald-600 active:scale-95"
      >
        Got it →
      </button>
    </div>
  );
}
