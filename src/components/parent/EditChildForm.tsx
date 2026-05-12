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
      className="flex flex-col gap-3 rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-xs text-[var(--color-sand-700)]">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          defaultValue={defaultDisplayName}
          maxLength={60}
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="birthYear" className="text-xs text-[var(--color-sand-700)]">
          Birth year
        </label>
        <input
          id="birthYear"
          name="birthYear"
          type="number"
          min={2000}
          max={new Date().getFullYear()}
          defaultValue={defaultBirthYear ?? ''}
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
        />
      </div>
      {state.error ? (
        <p className="text-xs text-[var(--color-bad)]">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-[var(--color-ocean-500)] px-5 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-95 disabled:bg-[var(--color-sand-200)] disabled:text-[var(--color-sand-700)]"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
