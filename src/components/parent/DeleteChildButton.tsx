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
      className="self-start rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? 'Deleting…' : `Delete ${childName}`}
    </button>
  );
}
