// Client-safe (no db imports): shared by scene components, runners, and actions.
import { z } from 'zod';

export const SELF_RATINGS = ['got_it', 'not_sure', 'dont_know'] as const;
export type SelfRating = (typeof SELF_RATINGS)[number];

export const ANSWER_SOURCES = ['review', 'practice', 'boss', 'homework', 'study'] as const;
export type AnswerSource = (typeof ANSWER_SOURCES)[number];

export const MAX_EVENTS_PER_CALL = 40;

/** One answered question. Exactly one of `correct` / `selfRating` must be set. */
export const SceneAnswerEventSchema = z
  .object({
    sceneType: z.string().min(1).max(64),
    characterId: z.string().uuid().nullish(),
    wordId: z.string().uuid().nullish(),
    itemKey: z.string().max(128).nullish(),
    correct: z.boolean().nullish(),
    selfRating: z.enum(SELF_RATINGS).nullish(),
    pickedKey: z.string().max(128).nullish(),
  })
  .refine((e) => (e.correct != null) !== (e.selfRating != null), {
    message: 'exactly one of correct/selfRating must be set',
  });

export type SceneAnswerEvent = z.infer<typeof SceneAnswerEventSchema>;
