'use client';

import { useState, useTransition } from 'react';
import { publishWeekAction } from '@/lib/actions/weeks';

export function PublishWeekButton({
  weekId,
  alreadyPublished,
}: {
  weekId: string;
  alreadyPublished: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(alreadyPublished);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const r = await publishWeekAction(weekId);
            if (r.error) setError(r.error);
            else setDone(true);
          });
        }}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending
          ? 'Publishing…'
          : done
            ? '✓ Published — re-publish'
            : 'Publish to play'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
