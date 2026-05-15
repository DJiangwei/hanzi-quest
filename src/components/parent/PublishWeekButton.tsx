'use client';

import { useState, useTransition } from 'react';
import { publishWeekAction } from '@/lib/actions/weeks';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

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
      <WoodSignButton
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const r = await publishWeekAction(weekId);
            if (r.error) setError(r.error);
            else setDone(true);
          });
        }}
      >
        {pending
          ? 'Publishing…'
          : done
            ? '✓ Published — re-publish'
            : 'Publish to play'}
      </WoodSignButton>
      {error ? <span className="text-xs text-[var(--color-bad)]">{error}</span> : null}
    </span>
  );
}
