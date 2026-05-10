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
        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
      >
        {pending ? 'Generating… (~3min)' : 'Generate AI'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
