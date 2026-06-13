'use client';

import { useState, useTransition } from 'react';
import { addHomeworkItemAction } from '@/lib/actions/homework';

interface Option {
  textZh: string;
  textEn: string;
}

interface Props {
  weekId: string;
  onSaved: () => void;
}

export function CharQuizForm({ weekId, onSaved }: Props) {
  const [hanzi, setHanzi] = useState('');
  const [questionZh, setQuestionZh] = useState('');
  const [options, setOptions] = useState<Option[]>([
    { textZh: '', textEn: '' },
    { textZh: '', textEn: '' },
  ]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function addOption() {
    if (options.length < 4) setOptions((prev) => [...prev, { textZh: '', textEn: '' }]);
  }

  function removeOption(i: number) {
    if (options.length > 2) {
      setOptions((prev) => prev.filter((_, idx) => idx !== i));
      if (correctIndex >= i && correctIndex > 0) setCorrectIndex((c) => c - 1);
    }
  }

  function updateOption(i: number, field: keyof Option, value: string) {
    setOptions((prev) => prev.map((opt, idx) => (idx === i ? { ...opt, [field]: value } : opt)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmedOptions = options.map((o) => ({
      textZh: o.textZh.trim(),
      textEn: o.textEn.trim(),
    }));
    const config = {
      hanzi: hanzi.trim() || undefined,
      questionZh: questionZh.trim(),
      options: trimmedOptions,
      correctIndex,
    };
    startTransition(async () => {
      try {
        await addHomeworkItemAction(weekId, 'char_quiz', config);
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
          字 (optional)
          <input
            type="text"
            value={hanzi}
            onChange={(e) => setHanzi(e.target.value)}
            className="block w-full border rounded px-2 py-1 text-sm mt-1"
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium">
          中文问题 *
          <input
            type="text"
            value={questionZh}
            onChange={(e) => setQuestionZh(e.target.value)}
            required
            className="block w-full border rounded px-2 py-1 text-sm mt-1"
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium mb-1">Options (2–4)</legend>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input
              type="radio"
              name="correctIndex"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              aria-label={`Correct answer: option ${i + 1}`}
            />
            <input
              type="text"
              placeholder="中文"
              value={opt.textZh}
              onChange={(e) => updateOption(i, 'textZh', e.target.value)}
              className="border rounded px-2 py-1 text-sm flex-1"
            />
            <input
              type="text"
              placeholder="English"
              value={opt.textEn}
              onChange={(e) => updateOption(i, 'textEn', e.target.value)}
              className="border rounded px-2 py-1 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
              className="text-xs text-red-500 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        {options.length < 4 && (
          <button type="button" onClick={addOption} className="text-xs text-blue-600">
            + Add option
          </button>
        )}
      </fieldset>
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
