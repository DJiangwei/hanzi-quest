'use client';

import { useMemo, useState } from 'react';
import { shuffle } from '@/lib/scenes/sample';

interface PairItem {
  characterId: string;
  hanzi: string;
  word: string;
}

interface Props {
  pairs: PairItem[]; // 2-6 pairs
  onComplete: (allCorrect: boolean) => void;
}

const COLORS = [
  'bg-rose-200 border-rose-400 text-rose-900',
  'bg-sky-200 border-sky-400 text-sky-900',
  'bg-emerald-200 border-emerald-400 text-emerald-900',
  'bg-amber-200 border-amber-400 text-amber-900',
  'bg-violet-200 border-violet-400 text-violet-900',
  'bg-lime-200 border-lime-400 text-lime-900',
];

export function WordMatchScene({ pairs, onComplete }: Props) {
  const [selectedHanzi, setSelectedHanzi] = useState<string | null>(null);
  const [matched, setMatched] = useState<Map<string, number>>(new Map());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);

  const shuffledWords = useMemo(
    () => shuffle(pairs.map((p) => ({ id: p.characterId, text: p.word }))),
    [pairs],
  );
  const orderedHanzi = pairs.map((p) => ({
    id: p.characterId,
    text: p.hanzi,
  }));

  const tryPair = (hanziId: string, wordId: string) => {
    if (matched.has(hanziId)) return;
    if (hanziId === wordId) {
      const idx = matched.size;
      const next = new Map(matched);
      next.set(hanziId, idx);
      setMatched(next);
      setSelectedHanzi(null);
      if (next.size === pairs.length) {
        setTimeout(() => onComplete(true), 500);
      }
    } else {
      setWrongFlash(`${hanziId}|${wordId}`);
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedHanzi(null);
      }, 600);
    }
  };

  const colorFor = (id: string): string | null => {
    const idx = matched.get(id);
    if (idx === undefined) return null;
    return COLORS[idx % COLORS.length];
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
      <p className="text-base text-zinc-600">把字和词组配对</p>
      <div className="flex w-full max-w-md flex-col gap-3">
        {orderedHanzi.map((h, rowIdx) => {
          const matchedColor = colorFor(h.id);
          const wordForRow = shuffledWords[rowIdx];
          const wordMatchedColor = colorFor(wordForRow.id);
          const isHanziSelected = selectedHanzi === h.id;
          const isWrongHanzi =
            wrongFlash !== null && wrongFlash.startsWith(`${h.id}|`);
          const isWrongWord =
            wrongFlash !== null && wrongFlash.endsWith(`|${wordForRow.id}`);

          return (
            <div key={`${h.id}-${rowIdx}`} className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={Boolean(matchedColor)}
                onClick={() =>
                  setSelectedHanzi((cur) => (cur === h.id ? null : h.id))
                }
                className={[
                  'rounded-xl border-2 px-4 py-4 text-3xl font-bold transition',
                  matchedColor ?? '',
                  isHanziSelected && !matchedColor
                    ? 'border-zinc-700 bg-zinc-100'
                    : '',
                  isWrongHanzi ? 'animate-pulse border-red-500 bg-red-50' : '',
                  !matchedColor && !isHanziSelected && !isWrongHanzi
                    ? 'border-zinc-200 bg-white hover:border-zinc-400'
                    : '',
                ].join(' ')}
              >
                {h.text}
              </button>
              <button
                type="button"
                disabled={Boolean(wordMatchedColor) || !selectedHanzi}
                onClick={() =>
                  selectedHanzi && tryPair(selectedHanzi, wordForRow.id)
                }
                className={[
                  'rounded-xl border-2 px-3 py-4 text-xl font-medium transition',
                  wordMatchedColor ?? '',
                  isWrongWord ? 'animate-pulse border-red-500 bg-red-50' : '',
                  !wordMatchedColor && !isWrongWord
                    ? 'border-zinc-200 bg-white hover:border-zinc-400 disabled:opacity-50'
                    : '',
                ].join(' ')}
              >
                {wordForRow.text}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-400">
        {matched.size} / {pairs.length} matched
      </p>
    </div>
  );
}
