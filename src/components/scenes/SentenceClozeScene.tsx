'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  sentenceText: string;
  translationEn: string | null;
  onComplete: (correct: boolean) => void;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
}

function blankOut(sentence: string, hanzi: string): string {
  // Replace the first occurrence of the target hanzi with a 4-char underline.
  return sentence.replace(hanzi, ' ____ ');
}

export function SentenceClozeScene({
  target,
  pool,
  sentenceText,
  translationEn,
  onComplete,
}: Props) {
  const choices = useMemo(() => {
    const distractors = sampleDistractors(
      pool,
      target,
      3,
      (a, b) => a.characterId === b.characterId,
    );
    return shuffle([target, ...distractors]);
  }, [pool, target]);

  const blanked = blankOut(sentenceText, target.hanzi);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">
      <p className="font-hanzi text-center text-lg text-[var(--color-ocean-700)]">
        听句子，填字 / Fill in the blank
      </p>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => speak(sentenceText)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-200 text-3xl shadow-lg transition-transform active:scale-95 hover:bg-emerald-300"
          aria-label="Play sentence"
        >
          🔊
        </button>
        <div className="rounded-2xl bg-emerald-50 px-6 py-3 text-2xl font-semibold text-emerald-900 shadow">
          {blanked}
        </div>
        {translationEn && (
          <div className="text-sm italic text-emerald-700">{translationEn}</div>
        )}
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {choices.map((c) => (
          <button
            key={c.characterId}
            type="button"
            onClick={() => onComplete(c.characterId === target.characterId)}
            className="rounded-2xl border-2 border-[var(--color-sand-200)] bg-white px-4 py-6 text-3xl font-bold shadow-sm transition-transform active:scale-95 hover:border-[var(--color-ocean-300)] hover:bg-[var(--color-ocean-100)]"
          >
            <span className="text-5xl">{c.hanzi}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
