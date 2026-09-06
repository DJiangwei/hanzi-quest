'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * One character to trace, wrapping hanzi-writer's quiz mode.
 *
 * **Imperative library in a React tree — three things this has to get right.**
 * hanzi-writer writes SVG into a DOM node it is handed, so it is created in an
 * effect, never in render; the instance is torn down on every change of
 * character (its `target` div is keyed, so React replaces the node and a stale
 * writer would draw into a detached one); and it is imported DYNAMICALLY,
 * because the module touches `document` at import time and this page is server
 * rendered.
 *
 * **Stroke data is fetched per character from a CDN at runtime.** That is
 * hanzi-writer's default and is deliberate here: the `hanzi-writer-data`
 * package is 32MB and carries the ARPHIC Public License rather than the
 * library's MIT, so bundling it would mean shipping and redistributing it.
 * Coverage was checked before building — all 176 characters she is taught
 * resolve. A fetch failure degrades to a message, never a blank box.
 */

export interface StrokeTracerProps {
  hanzi: string;
  /** Fired once the last stroke of the character is completed. */
  onComplete?: () => void;
  size?: number;
}

type Status = 'loading' | 'ready' | 'unavailable';

export function StrokeTracer({ hanzi, onComplete, size = 260 }: StrokeTracerProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  // useId, not a hardcoded id: two tracers on one page would otherwise write
  // into the same node (the same hazard AvatarRender's clipPaths have).
  const domId = useId().replace(/:/g, '');
  // Held in a ref so the effect below never depends on the callback identity —
  // a parent that re-creates `onComplete` each render would otherwise tear the
  // writer down and restart the character mid-stroke. Assigned in an effect,
  // not during render: `react-hooks/refs` forbids touching `.current` in a
  // render body, and it is right to — a render may be discarded.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let writer: { cancelQuiz?: () => void } | null = null;
    const node = holder.current;
    if (!node) return;
    node.innerHTML = '';
    setStatus('loading');

    (async () => {
      try {
        const mod = await import('hanzi-writer');
        if (cancelled) return;
        const HanziWriter = mod.default;
        writer = HanziWriter.create(node, hanzi, {
          width: size,
          height: size,
          padding: 8,
          showCharacter: false,
          showOutline: true,
          strokeColor: '#0f766e',
          outlineColor: '#d6d3d1',
          drawingColor: '#0f766e',
          drawingWidth: 24,
          // Generous on purpose. This is a six-year-old's finger on glass, and
          // the product softens 畏难情绪 everywhere else — a tracer that
          // rejects a nearly-right stroke would be the harshest surface in it.
          leniency: 1.6,
          showHintAfterMisses: 2,
        }) as unknown as { cancelQuiz?: () => void };
        setStatus('ready');
        (writer as unknown as {
          quiz: (o: { onComplete?: () => void }) => void;
        }).quiz({
          onComplete: () => onCompleteRef.current?.(),
        });
      } catch {
        // No stroke data, offline, or the CDN is unreachable. Say so; never
        // leave an empty square that reads as a broken page.
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      try {
        writer?.cancelQuiz?.();
      } catch {
        // Tearing down a writer that never finished loading is expected.
      }
      node.innerHTML = '';
    };
  }, [hanzi, size]);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="stroke-tracer">
      <div
        id={domId}
        ref={holder}
        aria-label={`描写 ${hanzi} / Trace ${hanzi}`}
        className="rounded-3xl border-2 border-dashed border-stone-300 bg-white"
        style={{ width: size, height: size }}
      />
      {status === 'loading' ? (
        <p className="text-xs text-[var(--color-sand-700)]" data-testid="tracer-loading">
          <span className="font-hanzi">正在准备…</span> <span className="italic">/ Loading…</span>
        </p>
      ) : null}
      {status === 'unavailable' ? (
        <p className="text-xs text-[var(--color-sand-700)]" data-testid="tracer-unavailable">
          <span className="font-hanzi">这个字暂时写不了,换一个吧。</span>
          <span className="mt-0.5 block italic">
            / This one can&apos;t be traced right now — try another.
          </span>
        </p>
      ) : null}
    </div>
  );
}
