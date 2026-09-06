'use client';

import { useMemo, useState } from 'react';
import { StrokeTracer } from '@/components/play/StrokeTracer';
import { SpeakButton } from '@/components/play/SpeakButton';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

/** Characters in one round. Short — writing is slow compared with tapping. */
const ROUND_SIZE = 5;

export interface WriteChar {
  characterId: string;
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
}

/**
 * 写字 — trace the characters she already knows, stroke by stroke.
 *
 * **Standalone, and carrying NO rewards, exactly like 听声调 did.** Stroke
 * tracing has an unverified premise of its own: whether a six-year-old's
 * finger on an iPad can satisfy hanzi-writer's stroke matching often enough to
 * feel like a game rather than a fight. Shipping it as a compiled scene type
 * would mean a `scene_templates` row, a `compile-week.ts` slot and a
 * `recompile-all-weeks.ts` run — real cost to unwind if the answer is no.
 * A page with no economy attached can simply be deleted.
 *
 * That pattern has now paid twice: the tone game was verified cheaply and its
 * practice integration then arrived free through V2's distractor slot.
 */
export function WriteGameBody({ chars }: { chars: WriteChar[] }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  // A different handful each round, WITHOUT randomness in the render body.
  // `chars` arrives already shuffled from the server, so rotating a window
  // over it gives variety deterministically — the same rule the MCQ landmine
  // states as "randomize upstream", and what `react-hooks/purity` enforces.
  const picks = useMemo(() => {
    if (chars.length === 0) return [];
    const start = (round * ROUND_SIZE) % chars.length;
    const window = [...chars.slice(start), ...chars.slice(0, start)];
    return window.slice(0, ROUND_SIZE);
  }, [chars, round]);

  const current = picks[index];

  if (picks.length === 0) {
    return (
      <p
        data-testid="write-empty"
        className="rounded-3xl border-2 border-dashed border-amber-300 bg-white/70 p-6 text-center text-sm text-amber-900"
      >
        <span className="font-hanzi block">先去岛上学几个字,再回来写。</span>
        <span className="mt-1 block italic text-amber-900/70">
          Learn a few characters first, then come back and write them.
        </span>
      </p>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center" data-testid="write-done">
        <div className="text-6xl">🖌️</div>
        <h2 className="font-hanzi text-2xl font-extrabold text-[var(--color-ocean-800)]">
          写完啦！<span className="text-lg font-semibold">/ All written</span>
        </h2>
        <WoodSignButton
          size="lg"
          onClick={() => {
            setRound((r) => r + 1);
            setIndex(0);
            setDone(new Set());
          }}
        >
          再写一组 / Write more
        </WoodSignButton>
      </div>
    );
  }

  const finished = done.has(current.characterId);

  return (
    <div className="flex w-full flex-col items-center gap-4" data-testid="write-game">
      <p className="text-xs text-[var(--color-sand-700)]">
        <span className="font-hanzi">写字</span> <span className="italic">/ Write</span> —{' '}
        {index + 1}/{picks.length}
      </p>

      <div className="flex items-center gap-2">
        <span className="font-hanzi text-2xl text-[var(--color-ocean-900)]">{current.hanzi}</span>
        <span className="text-sm text-[var(--color-sand-700)]">{current.pinyin.join(' ')}</span>
        <SpeakButton text={current.hanzi} />
      </div>
      {current.meaningEn ? (
        <p className="-mt-2 text-sm text-[var(--color-sand-700)]">{current.meaningEn}</p>
      ) : null}

      {/* Keyed on the character so React replaces the node between characters —
          hanzi-writer draws into the node it was handed, and reusing one would
          leave the previous character's strokes underneath. */}
      <StrokeTracer
        key={current.characterId}
        hanzi={current.hanzi}
        onComplete={() => setDone((d) => new Set(d).add(current.characterId))}
      />

      {finished ? (
        <p className="font-hanzi text-sm font-bold text-emerald-700" data-testid="write-stroke-done">
          写好了! <span className="font-sans italic font-medium">/ Nicely written!</span>
        </p>
      ) : (
        <p className="text-xs text-[var(--color-sand-700)]">
          <span className="font-hanzi">照着灰色的笔画写一遍。</span>{' '}
          <span className="italic">/ Trace over the grey strokes.</span>
        </p>
      )}

      {/* Always available, not gated on finishing. A stroke she cannot satisfy
          must never trap her on one character — the same reason skipped
          practice scenes score 0 rather than blocking. */}
      <WoodSignButton size="lg" onClick={() => setIndex((i) => i + 1)}>
        {finished ? '下一个 / Next' : '换一个 / Skip'}
      </WoodSignButton>
    </div>
  );
}
