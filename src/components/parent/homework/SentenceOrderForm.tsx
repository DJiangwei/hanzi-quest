'use client';

import { useState, useTransition } from 'react';
import { addHomeworkItemAction } from '@/lib/actions/homework';

interface Props {
  weekId: string;
  onSaved: () => void;
}

export function SentenceOrderForm({ weekId, onSaved }: Props) {
  const [tokens, setTokens] = useState<string[]>(['', '']);
  const [translationEn, setTranslationEn] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function addToken() {
    if (tokens.length < 12) setTokens((prev) => [...prev, '']);
  }

  function removeToken(i: number) {
    if (tokens.length > 2) setTokens((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateToken(i: number, value: string) {
    setTokens((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmedTokens = tokens.map((t) => t.trim()).filter(Boolean);
    const config = {
      tokens: trimmedTokens,
      translationEn: translationEn.trim() || undefined,
    };
    startTransition(async () => {
      try {
        await addHomeworkItemAction(weekId, 'sentence_order', config);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error saving item');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border p-3 rounded">
      <div>
        <label className="block text-sm font-medium mb-1">
          Tokens (2–12, in correct order)
        </label>
        {tokens.map((t, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input
              type="text"
              value={t}
              onChange={(e) => updateToken(i, e.target.value)}
              placeholder={`Token ${i + 1}`}
              className="border rounded px-2 py-1 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => removeToken(i)}
              disabled={tokens.length <= 2}
              className="text-xs text-red-500 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        {tokens.length < 12 && (
          <button type="button" onClick={addToken} className="text-xs text-blue-600">
            + Add token
          </button>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">
          Translation (English, optional)
          <input
            type="text"
            value={translationEn}
            onChange={(e) => setTranslationEn(e.target.value)}
            className="block w-full border rounded px-2 py-1 text-sm mt-1"
          />
        </label>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
