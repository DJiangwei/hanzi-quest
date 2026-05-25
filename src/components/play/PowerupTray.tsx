'use client';

import { useState, useTransition } from 'react';
import {
  useHintAction as hintAction,
  useSkipAction as skipAction,
} from '@/lib/actions/powerups';

interface Props {
  childId: string;
  hintCount: number;
  skipCount: number;
  sceneSupportsHint: boolean;
  weekLevelId: string;
  sessionId: string;
  onHintActivated: () => void;
  onSkipped: () => void;
}

export function PowerupTray({
  childId,
  hintCount,
  skipCount,
  sceneSupportsHint,
  weekLevelId,
  sessionId,
  onHintActivated,
  onSkipped,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<'hint' | 'skip' | null>(null);

  const requestHint = () => {
    if (hintCount === 0) return;
    setConfirming('hint');
  };
  const requestSkip = () => {
    if (skipCount === 0) return;
    setConfirming('skip');
  };

  const confirm = () => {
    if (!confirming) return;
    const kind = confirming;
    setConfirming(null);
    startTransition(async () => {
      if (kind === 'hint') {
        const r = await hintAction(childId);
        if (r.ok) onHintActivated();
      } else {
        const r = await skipAction(childId, weekLevelId, sessionId);
        if (r.ok) onSkipped();
      }
    });
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 flex gap-3">
        {sceneSupportsHint && (
          <button
            type="button"
            disabled={hintCount === 0 || pending}
            onClick={requestHint}
            aria-label="使用提示 / Use hint"
            className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-800/40 bg-amber-100 text-2xl shadow-lg disabled:opacity-40"
          >
            💡
            <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-amber-800/40 bg-white px-1.5 text-xs font-extrabold text-amber-900">
              {hintCount}
            </span>
          </button>
        )}
        <button
          type="button"
          disabled={skipCount === 0 || pending}
          onClick={requestSkip}
          aria-label="跳过 / Skip"
          className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-800/40 bg-amber-100 text-2xl shadow-lg disabled:opacity-40"
        >
          ⏭️
          <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-amber-800/40 bg-white px-1.5 text-xs font-extrabold text-amber-900">
            {skipCount}
          </span>
        </button>
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setConfirming(null)}
        >
          <div
            className="rounded-2xl border-4 border-amber-800/40 bg-amber-50 p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl">{confirming === 'hint' ? '💡' : '⏭️'}</div>
            <p className="mt-3 text-base font-bold text-amber-950">
              {confirming === 'hint'
                ? '使用提示？/ Use hint?'
                : '跳过这一关？/ Skip this scene?'}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-lg border-2 border-amber-800/40 bg-white px-4 py-2 text-sm font-bold text-amber-900"
              >
                取消 / Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="rounded-lg border-2 border-amber-800/40 bg-amber-300 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-40"
              >
                使用 / Use
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
