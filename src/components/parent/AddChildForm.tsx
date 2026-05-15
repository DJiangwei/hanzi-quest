'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  type ChildActionState,
  createChildAction,
} from '@/lib/actions/children';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

const INITIAL: ChildActionState = {};

export function AddChildForm() {
  const [state, formAction, pending] = useActionState(
    createChildAction,
    INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error && formRef.current) {
      formRef.current.reset();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        Add a child
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-xs text-[var(--color-sand-700)]">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
          placeholder="Yinuo"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="birthYear" className="text-xs text-[var(--color-sand-700)]">
          Birth year (optional)
        </label>
        <input
          id="birthYear"
          name="birthYear"
          type="number"
          min={2000}
          max={new Date().getFullYear()}
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
          placeholder="2019"
        />
      </div>
      {state.error ? (
        <p className="text-xs text-[var(--color-bad)]">{state.error}</p>
      ) : null}
      <WoodSignButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Adding…' : 'Add child'}
      </WoodSignButton>
    </form>
  );
}
