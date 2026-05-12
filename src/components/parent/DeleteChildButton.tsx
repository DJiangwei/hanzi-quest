'use client';

import { useTransition } from 'react';
import { deleteChildAction } from '@/lib/actions/children';

export function DeleteChildButton({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `Delete ${childName}? This removes all their progress permanently.`,
          )
        ) {
          startTransition(() => deleteChildAction(childId));
        }
      }}
      className="self-start rounded-full border-2 border-[var(--color-bad)] bg-white px-5 py-2 text-sm font-semibold text-[var(--color-bad)] hover:bg-[var(--color-bad-bg)] disabled:opacity-50"
    >
      {pending ? 'Deleting…' : `Delete ${childName}`}
    </button>
  );
}
