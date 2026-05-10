'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  type ChildActionState,
  createChildAction,
} from '@/lib/actions/children';

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
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
        Add a child
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-xs text-zinc-600">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          placeholder="Yinuo"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="birthYear" className="text-xs text-zinc-600">
          Birth year (optional)
        </label>
        <input
          id="birthYear"
          name="birthYear"
          type="number"
          min={2000}
          max={new Date().getFullYear()}
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          placeholder="2019"
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
        {pending ? 'Adding…' : 'Add child'}
      </button>
    </form>
  );
}
