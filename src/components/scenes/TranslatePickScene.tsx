'use client';

import { useMemo } from 'react';
import { blendDistractors, shuffle } from '@/lib/scenes/sample';
import type { TranslateDirection } from '@/lib/scenes/configs';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import { SpeakButton } from '@/components/play/SpeakButton';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  meaningEn: string | null;
  audioUrl?: string | null;
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  /**
   * Characters from weeks she has already CLEARED (A2 slice 1). One wrong
   * option comes from here. It passes through the SAME meaning filter as the
   * week pool — an older character with no English meaning, or with the
   * target's own meaning, would break this question type exactly as a
   * same-week one would.
   */
  olderPool?: CharacterDetail[];
  direction: TranslateDirection;
  onComplete: (correct: boolean) => void;
  /** Telemetry: emits one event per answered question. */
  onAnswerEvent?: (e: SceneAnswerEvent) => void;
  hintRequested?: boolean;
}

export function TranslatePickScene({ target, pool, olderPool = [], direction, onComplete, onAnswerEvent, hintRequested }: Props) {
  // Inlined rather than hoisted into a shared closure: a function defined in
  // the render body is a new reference every render, so naming it would either
  // break these memos or force it into the dep array and defeat them.
  const targetMeaning = target.meaningEn;
  const filteredPool = useMemo(
    () => pool.filter((c) => Boolean(c.meaningEn) && c.meaningEn !== targetMeaning),
    [pool, targetMeaning],
  );
  const filteredOlder = useMemo(
    () => olderPool.filter((c) => Boolean(c.meaningEn) && c.meaningEn !== targetMeaning),
    [olderPool, targetMeaning],
  );

  const choices = useMemo(() => {
    const distractors = blendDistractors(
      filteredPool,
      filteredOlder,
      target,
      3,
      undefined,
      (a, b) => a.characterId === b.characterId,
    );
    const all = shuffle([target, ...distractors]);
    return all.map((c) => ({
      key: c.characterId,
      label: (
        <span className={direction === 'cn_to_en' ? 'text-xl font-semibold' : 'text-5xl'}>
          {direction === 'cn_to_en' ? (c.meaningEn ?? '?') : c.hanzi}
        </span>
      ),
      isCorrect: c.characterId === target.characterId,
    }));
  }, [filteredPool, filteredOlder, target, direction]);

  const stimulus =
    direction === 'cn_to_en' ? (
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-amber-100 text-7xl font-bold text-amber-900 shadow-lg">
          {target.hanzi}
        </div>
        <SpeakButton text={target.hanzi} audioUrl={target.audioUrl} size="sm" label={`Play sound for ${target.hanzi}`} />
      </div>
    ) : (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-amber-100 px-8 text-3xl font-bold text-amber-900 shadow-lg">
        {target.meaningEn ?? '?'}
      </div>
    );

  const prompt =
    direction === 'cn_to_en'
      ? '它是什么意思？/ What does this mean?'
      : '选出对应的汉字 / Pick the matching character';

  return (
    <MultipleChoiceQuiz
      prompt={prompt}
      stimulus={stimulus}
      choices={choices}
      onComplete={onComplete}
      onResult={({ pickedKey, correct }) =>
        onAnswerEvent?.({ sceneType: 'translate_pick', characterId: target.characterId, correct, pickedKey })
      }
      hintRequested={hintRequested}
    />
  );
}
