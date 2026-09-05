'use client';

import { useMemo } from 'react';
import { blendDistractors, shuffle } from '@/lib/scenes/sample';
import { useSpeak } from '@/lib/hooks/useSpeak';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  audioUrl?: string | null;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  /**
   * Characters from weeks she has already CLEARED (A2 slice 1). One of the
   * three wrong options is drawn from here, so recognition keeps being
   * tested under interference instead of every week becoming an island.
   * Defaults to empty, which reproduces the pre-slice-1 behaviour exactly.
   */
  olderPool?: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  /** Telemetry: emits one event per answered question. */
  onAnswerEvent?: (e: SceneAnswerEvent) => void;
  hintRequested?: boolean;
}

export function AudioPickScene({ target, pool, olderPool = [], onComplete, onAnswerEvent, hintRequested }: Props) {
  const speak = useSpeak();

  const choices = useMemo(() => {
    const distractors = blendDistractors(
      pool,
      olderPool,
      target,
      3,
      undefined,
      (a, b) => a.characterId === b.characterId,
    );
    return shuffle([target, ...distractors]).map((c) => ({
      key: c.characterId,
      label: <span className="text-5xl">{c.hanzi}</span>,
      isCorrect: c.characterId === target.characterId,
    }));
  }, [pool, olderPool, target]);

  return (
    <MultipleChoiceQuiz
      prompt="听一听，选出对的字 / Listen and pick the character"
      stimulus={
        <button
          type="button"
          onClick={() => speak(target.hanzi, target.audioUrl)}
          className="flex h-32 w-32 items-center justify-center rounded-full bg-sky-200 text-5xl text-sky-900 shadow-lg transition-transform active:scale-95 hover:bg-sky-300"
          aria-label="Play audio"
        >
          🔊
        </button>
      }
      choices={choices}
      onComplete={onComplete}
      onResult={({ pickedKey, correct }) =>
        onAnswerEvent?.({ sceneType: 'audio_pick', characterId: target.characterId, correct, pickedKey })
      }
      hintRequested={hintRequested}
    />
  );
}
