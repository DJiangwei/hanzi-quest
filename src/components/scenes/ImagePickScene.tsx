'use client';

import { useMemo } from 'react';
import { blendDistractors, shuffle } from '@/lib/scenes/sample';
import { COUNTING_CHAR_VALUES } from '@/lib/scenes/stimulus-validity';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import { HintBubble } from './HintBubble';
import { CountingBalloons } from './fx/CountingBalloons';
import type { SceneAnswerEvent } from '@/lib/play/answer-events';

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
  /**
   * Characters from weeks she has already CLEARED (A2 slice 1). SceneRunner
   * must have already removed any character that owns this scene's stimulus
   * word — a picture that identifies two of the options has no right answer,
   * which is the PR #158 defect reappearing across weeks instead of within
   * one. Defaults to empty, reproducing the pre-slice-1 behaviour exactly.
   */
  olderPool?: CharacterDetail[];
  /** A picture (reused from one of the char's words) shown as the stimulus. */
  imageUrl?: string | null;
  /** English description of the picture (the stimulus word's imageHook) —
   *  revealed by the free 💡 hint. */
  imageHint?: string | null;
  onComplete: (correct: boolean) => void;
  /** Telemetry: emits one event per answered question. */
  onAnswerEvent?: (e: SceneAnswerEvent) => void;
  hintRequested?: boolean;
}

export function ImagePickScene({ target, pool, olderPool = [], imageUrl, imageHint, onComplete, onAnswerEvent, hintRequested }: Props) {
  // A counting character (一...十) never shows a diffusion picture, no
  // matter what `imageUrl`/`imageHint` the caller resolved — a host's
  // pickStimulusImage() fallback can still find SOME word image for one
  // (it just scans for the first word with a URL, unaware of
  // counting-ness), and that image would have the wrong count. This check
  // lives HERE, in the one component all three image_pick hosts
  // (SceneRunner, BossScene, FinalBossScene) render through, so fixing it
  // once fixes it everywhere — no per-host call to remember. See
  // src/components/scenes/fx/CountingBalloons.tsx and
  // docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md.
  const countingValue = COUNTING_CHAR_VALUES.get(target.hanzi);

  // Shuffle ONCE per scene (keyed on the stable characterId, not the target/pool
  // object identity) — otherwise a parent re-render reshuffles the options
  // mid-selection, making them jump around.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.characterId]);

  return (
    <MultipleChoiceQuiz
      prompt="看图找字 / Find the character"
      stimulus={
        countingValue !== undefined ? (
          <div className="flex flex-col items-center">
            <div className="h-48 w-72 overflow-hidden rounded-2xl border-4 border-amber-800/30 bg-amber-50 shadow-lg">
              <CountingBalloons count={countingValue} />
            </div>
            {/* Deliberately no HintBubble here, even when hintRequested: the
                stimulus word's own imageHook reads like "seven colorful
                balloons floating in a bright blue sky" — showing it as a
                hint would just say the answer out loud in English. Counting
                the balloons already IS the hint; nothing else is needed. */}
          </div>
        ) : imageUrl ? (
          <div className="flex flex-col items-center">
            <div className="h-48 w-72 overflow-hidden rounded-2xl border-4 border-amber-800/30 bg-amber-50 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={target.imageHook ?? target.hanzi}
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
            {hintRequested && imageHint ? <HintBubble text={imageHint} /> : null}
          </div>
        ) : (
          <div className="flex h-48 w-72 items-center justify-center rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 text-center text-base text-amber-900 shadow-sm">
            {target.imageHook ?? '（暂无图像描述）/ (no image yet)'}
          </div>
        )
      }
      choices={choices}
      onComplete={onComplete}
      onResult={({ pickedKey, correct }) =>
        onAnswerEvent?.({ sceneType: 'image_pick', characterId: target.characterId, correct, pickedKey })
      }
      hintRequested={hintRequested}
      postRevealAudio={target.hanzi}
      postRevealAudioUrl={target.audioUrl}
    />
  );
}
