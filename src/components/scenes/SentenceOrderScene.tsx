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
  // Deterministic (pure) but well-mixed visual shuffle of the pool. Seeded from
  // the token chars so it's stable per render. A plain `(a*k)%n` comparator
  // collapses to the identity for some n (e.g. n=3, n=7 — the common sentence
  // lengths), which would render the chips already in order; a seeded
  // Fisher-Yates + an anti-identity rotation guarantees a visibly shuffled order.
  const visualOrder = useMemo(() => {
    const n = pool.length;
    const arr = Array.from({ length: n }, (_, i) => i);
    let seed = (pool.reduce((s, t) => s + t.text.charCodeAt(0), 0) + n * 97) >>> 0;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    if (n > 1 && arr.every((v, i) => v === i)) arr.push(arr.shift()!); // never identity
    return arr;
  }, [pool]);
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
