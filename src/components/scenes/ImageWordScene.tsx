'use client';

import { useMemo } from 'react';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import { shuffle } from '@/lib/scenes/sample';
import { useSpeak } from '@/lib/hooks/useSpeak';
import { useSpeechSupported } from '@/lib/hooks/useSpeechSupported';

interface WordOption {
  wordId: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
  imageUrl: string | null;
  audioUrl?: string | null;
}

interface BaseChar {
  characterId: string;
  hanzi: string;
}

interface Props {
  baseChar: BaseChar;
  /** The week's learned characters — highlighted inside each word option. */
  weekChars: string[];
  correctWord: WordOption;
  distractors: WordOption[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

/**
 * One word option: the week's learned characters highlighted within the word,
 * plus a 🔊 to hear the word read aloud — scaffolds for this learning stage. The
 * speaker is a `role=button` span (not a nested <button>) with stopPropagation so
 * tapping it pronounces the word without selecting the option.
 */
function WordLabel({
  text,
  audioUrl,
  weekCharSet,
  speak,
  canSpeak,
}: {
  text: string;
  audioUrl: string | null;
  weekCharSet: Set<string>;
  speak: (text: string, audioUrl?: string | null) => void;
  canSpeak: boolean;
}) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="text-3xl font-extrabold leading-tight">
        {[...text].map((ch, i) => (
          <span key={i} className={weekCharSet.has(ch) ? 'text-amber-600' : 'text-stone-800'}>
            {ch}
          </span>
        ))}
      </span>
      {(canSpeak || audioUrl) && (
        <span
          role="button"
          tabIndex={0}
          aria-label="朗读 / Read aloud"
          data-testid={`speak-${text}`}
          onClick={(e) => {
            e.stopPropagation();
            speak(text, audioUrl);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              speak(text, audioUrl);
            }
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg text-sky-700 hover:bg-sky-200"
        >
          🔊
        </span>
      )}
    </span>
  );
}

export function ImageWordScene({
  weekChars,
  correctWord,
  distractors,
  onComplete,
  hintRequested,
}: Props) {
  const speak = useSpeak();
  const canSpeak = useSpeechSupported();
  const weekCharSet = useMemo(() => new Set(weekChars), [weekChars]);
  // Shuffle ONCE per scene (keyed on the stable correctWord.wordId) so a parent
  // re-render never reshuffles the options mid-selection.
  const choices = useMemo(
    () =>
      shuffle([correctWord, ...distractors]).map((w) => ({
        key: w.wordId,
        label: (
          <WordLabel
            text={w.text}
            audioUrl={w.audioUrl ?? null}
            weekCharSet={weekCharSet}
            speak={speak}
            canSpeak={canSpeak}
          />
        ),
        isCorrect: w.wordId === correctWord.wordId,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [correctWord.wordId],
  );

  const stimulusText = correctWord.imageHook ?? correctWord.meaningEn ?? correctWord.text;

  const stimulus = correctWord.imageUrl ? (
    <div className="h-48 w-72 overflow-hidden rounded-2xl border-4 border-amber-800/30 bg-amber-50 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={correctWord.imageUrl}
        alt={stimulusText}
        className="h-full w-full object-cover"
        loading="eager"
      />
    </div>
  ) : (
    <div className="flex h-48 w-72 items-center justify-center rounded-2xl border-4 border-amber-800/30 bg-gradient-to-br from-amber-50 via-sky-50 to-amber-50 p-5 text-center shadow-lg">
      <span className="mr-2 shrink-0 text-3xl" aria-hidden>
        ✨
      </span>
      <p className="text-base font-semibold leading-snug text-amber-950">
        {stimulusText}
      </p>
    </div>
  );

  return (
    <MultipleChoiceQuiz
      prompt="看图选词 / Match the picture to a word"
      stimulus={stimulus}
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
      postRevealAudio={correctWord.text}
    />
  );
}
