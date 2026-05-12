'use client';

import { useState, useTransition } from 'react';
import { generateWeekAction } from '@/lib/actions/weeks';

export function GenerateWeekButton({ weekId }: { weekId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const r = await generateWeekAction(weekId);
            if (r?.error) setError(r.error);
          });
        }}
        className="rounded-full bg-[var(--color-sunset-500)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:bg-[var(--color-sunset-600)] active:scale-95 disabled:opacity-60"
      >
        {pending ? 'Generating… (~3min)' : 'Generate AI'}
      </button>
      {error ? (
        <span className="text-xs text-[var(--color-bad)]">{error}</span>
      ) : null}
    </span>
  );
}
