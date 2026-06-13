'use client';

import { useState, useTransition } from 'react';
import { addHomeworkItemAction } from '@/lib/actions/homework';

interface Props {
  weekId: string;
  onSaved: () => void;
}

export function WordBuildingForm({ weekId, onSaved }: Props) {
  const [baseChar, setBaseChar] = useState('');
  const [correctWord, setCorrectWord] = useState('');
  const [distractors, setDistractors] = useState<string[]>(['']);
  const [correctMeaningEn, setCorrectMeaningEn] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function addDistractor() {
    if (distractors.length < 5) setDistractors((prev) => [...prev, '']);
  }

  function removeDistractor(i: number) {
    if (distractors.length > 1) setDistractors((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateDistractor(i: number, value: string) {
    setDistractors((prev) => prev.map((d, idx) => (idx === i ? value : d)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmedDistractors = distractors.map((d) => d.trim()).filter(Boolean);
    const config = {
      baseChar: baseChar.trim(),
      correctWord: correctWord.trim(),
      distractors: trimmedDistractors,
      correctMeaningEn: correctMeaningEn.trim() || undefined,
    };
    startTransition(async () => {
      try {
        await addHomeworkItemAction(weekId, 'word_building', config);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error saving item');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border p-3 rounded">
      <div>
        <label className="block text-sm font-medium">
          Base char *
          <input
            type="text"
            value={baseChar}
            onChange={(e) => setBaseChar(e.target.value)}
            required
            className="block w-full border rounded px-2 py-1 text-sm mt-1"
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium">
          Correct word *
          <input
            type="text"
            value={correctWord}
            onChange={(e) => setCorrectWord(e.target.value)}
            required
            className="block w-full border rounded px-2 py-1 text-sm mt-1"
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Distractors (1–5)
        </label>
        {distractors.map((d, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input
              type="text"
              value={d}
              onChange={(e) => updateDistractor(i, e.target.value)}
              placeholder={`Distractor ${i + 1}`}
              className="border rounded px-2 py-1 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => removeDistractor(i)}
              disabled={distractors.length <= 1}
              className="text-xs text-red-500 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        {distractors.length < 5 && (
          <button type="button" onClick={addDistractor} className="text-xs text-blue-600">
            + Add distractor
          </button>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">
          Meaning (English, optional)
          <input
            type="text"
            value={correctMeaningEn}
            onChange={(e) => setCorrectMeaningEn(e.target.value)}
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
