'use client';

import { useActionState } from 'react';
import {
  type ChildActionState,
  updateChildAction,
} from '@/lib/actions/children';

const INITIAL: ChildActionState = {};

interface Props {
  childId: string;
  defaultDisplayName: string;
  defaultBirthYear: number | null;
}

export function EditChildForm({
  childId,
  defaultDisplayName,
  defaultBirthYear,
}: Props) {
  const boundAction = updateChildAction.bind(null, childId);
  const [state, formAction, pending] = useActionState(boundAction, INITIAL);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-xs text-zinc-600">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          defaultValue={defaultDisplayName}
          maxLength={60}
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="birthYear" className="text-xs text-zinc-600">
          Birth year
        </label>
        <input
          id="birthYear"
          name="birthYear"
          type="number"
          min={2000}
          max={new Date().getFullYear()}
          defaultValue={defaultBirthYear ?? ''}
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      {state.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-400"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
