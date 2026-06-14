'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  imageHook: string | null;
  audioUrl?: string | null;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  /** A picture (reused from one of the char's words) shown as the stimulus. */
  imageUrl?: string | null;
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function ImagePickScene({ target, pool, imageUrl, onComplete, hintRequested }: Props) {
  // Shuffle ONCE per scene (keyed on the stable characterId, not the target/pool
  // object identity) — otherwise a parent re-render reshuffles the options
  // mid-selection, making them jump around.
  const choices = useMemo(() => {
    const distractors = sampleDistractors(
      pool,
      target,
      3,
      (a, b) => a.characterId === b.characterId,
    );
    return shuffle([target, ...distractors]).map((c) => ({
      key: c.characterId,
      label: <span className="text-5xl">{c.hanzi}</span>,
      isCorrect: c.characterId === target.characterId,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.characterId]);

  return (
    <MultipleChoiceQuiz
      prompt="看图找字 / Find the character"
      stimulus={
        imageUrl ? (
          <div className="h-48 w-72 overflow-hidden rounded-2xl border-4 border-amber-800/30 bg-amber-50 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={target.imageHook ?? target.hanzi}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        ) : (
          <div className="flex h-48 w-72 items-center justify-center rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 text-center text-base text-amber-900 shadow-sm">
            {target.imageHook ?? '（暂无图像描述）/ (no image yet)'}
          </div>
        )
      }
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
      postRevealAudio={target.hanzi}
      postRevealAudioUrl={target.audioUrl}
    />
  );
}
