'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  regenerateCharacterAction,
  saveCharacterEditsAction,
} from '@/lib/actions/weeks';

const INITIAL = {} as { error?: string };

interface WordInput {
  text: string;
  pinyinJoined: string;
  meaningEn: string;
}

interface Props {
  weekId: string;
  characterId: string;
  hanzi: string;
  pinyinJoined: string;
  meaningEn: string;
  meaningZh: string;
  words: WordInput[];
  sentence: {
    text: string;
    pinyinJoined: string;
    meaningEn: string;
  };
}

export function CharacterReviewCard(props: Props) {
  const boundSave = saveCharacterEditsAction.bind(
    null,
    props.weekId,
    props.characterId,
  );
  const [saveState, saveAction, savePending] = useActionState(
    boundSave,
    INITIAL,
  );
  const [regenPending, startRegen] = useTransition();
  const [regenError, setRegenError] = useState<string | undefined>(undefined);

  return (
    <form
      action={saveAction}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-5xl font-bold">{props.hanzi}</h3>
        <button
          type="button"
          disabled={regenPending || savePending}
          onClick={() => {
            setRegenError(undefined);
            startRegen(async () => {
              const r = await regenerateCharacterAction(
                props.weekId,
                props.characterId,
              );
              if (r.error) setRegenError(r.error);
            });
          }}
          className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
        >
          {regenPending ? 'Regenerating…' : 'Regenerate'}
        </button>
      </header>

      {regenError ? (
        <p className="text-xs text-red-600">{regenError}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field
          label="Pinyin (space-separated)"
          name="pinyin"
          defaultValue={props.pinyinJoined}
        />
        <Field
          label="Meaning (English)"
          name="meaningEn"
          defaultValue={props.meaningEn}
        />
        <Field
          label="Meaning (中文)"
          name="meaningZh"
          defaultValue={props.meaningZh}
        />
      </div>

      <fieldset className="flex flex-col gap-2 rounded border border-zinc-100 p-3">
        <legend className="px-1 text-xs uppercase tracking-widest text-zinc-500">
          Words
        </legend>
        {[1, 2, 3].map((idx) => {
          const w = props.words[idx - 1] ?? {
            text: '',
            pinyinJoined: '',
            meaningEn: '',
          };
          return (
            <div key={idx} className="grid grid-cols-3 gap-2 text-sm">
              <Field
                label={`#${idx}`}
                name={`word${idx}`}
                defaultValue={w.text}
              />
              <Field
                label="pinyin"
                name={`word${idx}Pinyin`}
                defaultValue={w.pinyinJoined}
              />
              <Field
                label="meaning"
                name={`word${idx}Meaning`}
                defaultValue={w.meaningEn}
              />
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded border border-zinc-100 p-3">
        <legend className="px-1 text-xs uppercase tracking-widest text-zinc-500">
          Sentence
        </legend>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Field
            label="Text"
            name="sentence"
            defaultValue={props.sentence.text}
          />
          <Field
            label="Pinyin"
            name="sentencePinyin"
            defaultValue={props.sentence.pinyinJoined}
          />
          <Field
            label="Meaning"
            name="sentenceMeaning"
            defaultValue={props.sentence.meaningEn}
          />
        </div>
      </fieldset>

      {saveState.error ? (
        <p className="text-xs text-red-600">{saveState.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={savePending || regenPending}
        className="self-end rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-400"
      >
        {savePending ? 'Saving…' : 'Save edits'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
      />
    </label>
  );
}

