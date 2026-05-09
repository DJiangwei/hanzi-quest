import type { ComponentType } from 'react';
import type { z } from 'zod';

export type SceneType =
  | 'flashcard'
  | 'audio_pick'
  | 'visual_pick'
  | 'image_pick'
  | 'word_match'
  | 'tracing'
  | 'boss';

export interface SceneResult {
  correct: number;
  total: number;
  hintsUsed: number;
  score: number;
  durationMs: number;
}

export interface SceneProps<C> {
  config: C;
  onComplete: (result: SceneResult) => void;
}

export interface SceneRegistration<C> {
  type: SceneType;
  configSchema: z.ZodType<C>;
  Component: ComponentType<SceneProps<C>>;
}
