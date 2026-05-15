'use client';

import { useTransition } from 'react';
import { deleteChildAction } from '@/lib/actions/children';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

export function DeleteChildButton({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <WoodSignButton
      variant="ghost"
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
      className="self-start"
    >
      {pending ? 'Deleting…' : `Delete ${childName}`}
    </WoodSignButton>
  );
}
