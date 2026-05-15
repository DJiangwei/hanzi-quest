'use client';

import { useState, useTransition } from 'react';
import { generateWeekAction } from '@/lib/actions/weeks';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

export function GenerateWeekButton({ weekId }: { weekId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <span className="flex items-center gap-2">
      <WoodSignButton
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const r = await generateWeekAction(weekId);
            if (r?.error) setError(r.error);
          });
        }}
      >
        {pending ? 'Generating… (~3min)' : 'Generate AI'}
      </WoodSignButton>
      {error ? (
        <span className="text-xs text-[var(--color-bad)]">{error}</span>
      ) : null}
    </span>
  );
}
