'use client';

import { useActionState, useState } from 'react';
import {
  type CreateStageState,
  createStageAction,
} from '@/lib/actions/weeks';

const INITIAL: CreateStageState = {};
const PLACEHOLDER = `人 口 大 中 小 哭 笑 一 上 下
爸 天 太 月 二 妈 土 阳 亮 星
云 火 水 三 我 地 山 石 木 好`;

interface Props {
  kids: Array<{ id: string; displayName: string }>;
}

export function NewStageForm({ kids }: Props) {
  const [state, formAction, pending] = useActionState(
    createStageAction,
    INITIAL,
  );
  const [rawText, setRawText] = useState('');

  const linesPreview = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

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
        <label
          htmlFor="labelPrefix"
          className="text-xs text-[var(--color-sand-700)]"
        >
          Label prefix (each lesson becomes &ldquo;PREFIX 1&rdquo;, &ldquo;PREFIX
          2&rdquo;, …)
        </label>
        <input
          id="labelPrefix"
          name="labelPrefix"
          required
          maxLength={40}
          defaultValue="Lesson"
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 text-sm focus:border-[var(--color-ocean-500)] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rawText" className="text-xs text-[var(--color-sand-700)]">
          Characters — one lesson per line. Anything non-Chinese is ignored.
        </label>
        <textarea
          id="rawText"
          name="rawText"
          required
          rows={12}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={PLACEHOLDER}
          className="rounded-xl border border-[var(--color-sand-200)] px-3 py-2 font-hanzi text-lg focus:border-[var(--color-ocean-500)] focus:outline-none"
        />
        <p className="text-xs text-[var(--color-sand-700)]">
          {linesPreview.length === 0
            ? 'Each non-empty line creates one draft week with 1–12 characters.'
            : `${linesPreview.length} lesson${linesPreview.length === 1 ? '' : 's'} will be created as drafts.`}
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-[var(--color-bad)]">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-[var(--color-ocean-500)] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-95 disabled:bg-[var(--color-sand-200)] disabled:text-[var(--color-sand-700)]"
      >
        {pending ? 'Creating…' : 'Create draft lessons'}
      </button>

      <p className="text-xs text-[var(--color-sand-700)]">
        AI generation runs separately, one week at a time, from the dashboard.
        Each week takes ~3 minutes on DeepSeek V4 Pro.
      </p>
    </form>
  );
}
