'use client';

import { useActionState } from 'react';
import {
  type ChildActionState,
  updateChildAction,
} from '@/lib/actions/children';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

const INITIAL: ChildActionState = {};

interface Props {
  childId: string;
  defaultDisplayName: string;
  defaultGender: string | null;
  defaultBirthYear: number | null;
}

export function EditChildForm({
  childId,
  defaultDisplayName,
  defaultGender,
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
        <span className="text-xs text-[var(--color-sand-700)]">
          Gender (sets the default avatar)
        </span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="gender"
              value="boy"
              defaultChecked={defaultGender === 'boy'}
            />
            男孩 / Boy
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="gender"
              value="girl"
              defaultChecked={defaultGender === 'girl'}
            />
            女孩 / Girl
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="gender"
              value=""
              defaultChecked={defaultGender == null}
            />
            未设置 / Neutral
          </label>
        </div>
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
      <WoodSignButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save changes'}
      </WoodSignButton>
    </form>
  );
}
