'use client';

import { useActionState } from 'react';
import {
  type CreateWeekState,
  createWeekAction,
} from '@/lib/actions/weeks';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

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
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="kidId" className="text-xs text-[var(--color-sand-700)]">
          Child
        </label>
        <select
          id="kidId"
          name="childId"
          required
          defaultValue={kids.length === 1 ? kids[0].id : ''}
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
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
        <label htmlFor="label" className="text-xs text-[var(--color-sand-700)]">
          Week label
        </label>
        <input
          id="label"
          name="label"
          required
          maxLength={80}
          placeholder="e.g. Week 1 — 山火大"
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rawChars" className="text-xs text-[var(--color-sand-700)]">
          Characters (paste anything; only Chinese characters are extracted,
          dedupe automatic)
        </label>
        <textarea
          id="rawChars"
          name="rawChars"
          required
          rows={4}
          placeholder="一 二 三 四 五 六 七 八 九 十"
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 font-hanzi text-lg focus:border-[var(--color-ocean-500)] focus:outline-none"
        />
        <p className="text-xs text-[var(--color-sand-700)]">
          Need 1–12 unique characters. Anything else (spaces, commas, English,
          pinyin) is ignored.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-[var(--color-bad)]">{state.error}</p>
      ) : null}

      <WoodSignButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Generating with AI… (~30s)' : 'Generate week'}
      </WoodSignButton>
    </form>
  );
}
