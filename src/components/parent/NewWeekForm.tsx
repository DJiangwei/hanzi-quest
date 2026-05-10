'use client';

import { useActionState } from 'react';
import {
  type CreateWeekState,
  createWeekAction,
} from '@/lib/actions/weeks';

const INITIAL: CreateWeekState = {};

interface Props {
  kids: Array<{ id: string; displayName: string }>;
}

export function NewWeekForm({ kids }: Props) {
  const [state, formAction, pending] = useActionState(
    createWeekAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="childId" className="text-xs text-zinc-600">
          Child
        </label>
        <select
          id="childId"
          name="childId"
          required
          defaultValue={kids.length === 1 ? kids[0].id : ''}
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          {kids.length !== 1 ? (
            <option value="" disabled>
              Pick a child…
            </option>
          ) : null}
          {kids.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="label" className="text-xs text-zinc-600">
          Week label
        </label>
        <input
          id="label"
          name="label"
          required
          maxLength={80}
          placeholder="e.g. Week 1 — 山火大"
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rawChars" className="text-xs text-zinc-600">
          Characters (paste anything; only Chinese characters are extracted, dedupe automatic)
        </label>
        <textarea
          id="rawChars"
          name="rawChars"
          required
          rows={4}
          placeholder="一 二 三 四 五 六 七 八 九 十"
          className="rounded border border-zinc-300 px-3 py-2 font-mono text-base focus:border-zinc-500 focus:outline-none"
        />
        <p className="text-xs text-zinc-400">
          Need 1–12 unique characters. Anything else (spaces, commas, English,
          pinyin) is ignored.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-400"
      >
        {pending ? 'Generating with AI… (~30s)' : 'Generate week'}
      </button>
    </form>
  );
}
