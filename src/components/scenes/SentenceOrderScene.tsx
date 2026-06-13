'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';
import { ShakeWrap } from './fx/ShakeWrap';

interface Props {
  tokens: string[];
  translationEn?: string | null;
  onComplete: (correct: boolean) => void;
}

interface Token {
  id: number;
  text: string;
}

export function SentenceOrderScene({ tokens, translationEn, onComplete }: Props) {
  const reduced = useReducedMotion();
  const pool = useMemo<Token[]>(() => tokens.map((text, id) => ({ id, text })), [tokens]);
  const visualOrder = useMemo(
    () =>
      pool
        .map((_, i) => i)
        .sort((a, b) => ((a * 7 + 3) % pool.length) - ((b * 7 + 3) % pool.length)),
    [pool],
  );
  const [placed, setPlaced] = useState<Token[]>([]);
  const [shakeKey, setShakeKey] = useState(0);

  // Use a ref so tapPool closure always reads current placed value
  const placedRef = useRef<Token[]>([]);

  const placedIds = new Set(placed.map((t) => t.id));

  const tapPool = useCallback(
    (t: Token) => {
      const current = placedRef.current;
      if (current.some((x) => x.id === t.id)) return;
      const next = [...current, t];
      placedRef.current = next;
      setPlaced(next);
      if (next.length === tokens.length) {
        const correct = next.map((x) => x.text).join('') === tokens.join('');
        if (correct) {
          if (!reduced) playSound('ding');
          onComplete(true);
        } else {
          if (!reduced) playSound('buzz');
          setShakeKey((k) => k + 1);
          setTimeout(
            () => {
              placedRef.current = [];
              setPlaced([]);
            },
            reduced ? 0 : 500,
          );
        }
      }
    },
    [tokens, reduced, onComplete],
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <p className="text-center text-lg font-bold text-[var(--color-ocean-900)]">
        连词成句 / Put the words in order
      </p>
      <ShakeWrap triggerKey={shakeKey}>
        <div
          data-testid="answer-row"
          className="flex min-h-14 w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3"
        >
          {placed.map((t) => (
            <span
              key={t.id}
              className="rounded-xl bg-[var(--color-ocean-600)] px-3 py-2 text-xl font-bold text-white"
            >
              {t.text}
            </span>
          ))}
        </div>
      </ShakeWrap>
      <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-2">
        {pool.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={placedIds.has(t.id)}
            style={{ order: visualOrder.indexOf(t.id) }}
            onClick={() => tapPool(t)}
            className="rounded-xl border-2 border-amber-700/40 bg-white px-4 py-2 text-2xl font-bold text-amber-950 disabled:opacity-30"
          >
            {t.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => { placedRef.current = []; setPlaced([]); }}
        className="rounded-full bg-white/70 px-4 py-1.5 text-sm font-semibold text-amber-900"
      >
        ↩︎ 重来 / Reset
      </button>
      {translationEn ? (
        <p className="text-center text-xs text-[var(--color-sand-600)]">{translationEn}</p>
      ) : null}
    </main>
  );
}
