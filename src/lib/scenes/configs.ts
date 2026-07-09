import { z } from 'zod';

export const SegmentSchema = z.enum([
  'review',
  'sound',
  'sight',
  'meaning',
  'boss',
]);
export type Segment = z.infer<typeof SegmentSchema>;

// Common shape: every scene config carries the segment it belongs to.
// `segment` is optional on parse so old rows compiled before PR #30 keep
// validating; the runner treats `undefined` segment as "no chip".
const withSegment = { segment: SegmentSchema.optional() };

export const FlashcardConfigSchema = z.object({
  characterId: z.string().uuid(),
  hanzi: z.string().min(1).max(2),
  ...withSegment,
});
export type FlashcardConfig = z.infer<typeof FlashcardConfigSchema>;

export const AudioPickConfigSchema = z.object({
  characterId: z.string().uuid(),
  ...withSegment,
});
export type AudioPickConfig = z.infer<typeof AudioPickConfigSchema>;

export const VisualPickConfigSchema = z.object({
  characterId: z.string().uuid(),
  ...withSegment,
});
export type VisualPickConfig = z.infer<typeof VisualPickConfigSchema>;

export const ImagePickConfigSchema = z.object({
  characterId: z.string().uuid(),
  ...withSegment,
});
export type ImagePickConfig = z.infer<typeof ImagePickConfigSchema>;

export const WordMatchConfigSchema = z.object({
  characterIds: z.array(z.string().uuid()).min(2).max(6),
  ...withSegment,
});
export type WordMatchConfig = z.infer<typeof WordMatchConfigSchema>;

export const LianliankanConfigSchema = z.object({
  characterIds: z.array(z.string().uuid()).length(4),
  ...withSegment,
});
export type LianliankanConfig = z.infer<typeof LianliankanConfigSchema>;

export const PinyinPickConfigSchema = z.object({
  characterId: z.string().uuid(),
  ...withSegment,
});
export type PinyinPickConfig = z.infer<typeof PinyinPickConfigSchema>;

export const TranslateDirectionSchema = z.enum(['cn_to_en', 'en_to_cn']);
export type TranslateDirection = z.infer<typeof TranslateDirectionSchema>;

export const TranslatePickConfigSchema = z.object({
  characterId: z.string().uuid(),
  direction: TranslateDirectionSchema,
  ...withSegment,
});
export type TranslatePickConfig = z.infer<typeof TranslatePickConfigSchema>;

export const SentenceClozeConfigSchema = z.object({
  characterId: z.string().uuid(),
  sentenceId: z.string().uuid(),
  ...withSegment,
});
export type SentenceClozeConfig = z.infer<typeof SentenceClozeConfigSchema>;

export const BossQuestionTypeSchema = z.enum([
  'audio_pick',
  'visual_pick',
  'image_pick',
  'pinyin_pick',
  'translate_pick',
  'sentence_cloze',
]);
export type BossQuestionType = z.infer<typeof BossQuestionTypeSchema>;

export const BossConfigSchema = z.object({
  characterIds: z.array(z.string().uuid()).min(2),
  questionTypes: z.array(BossQuestionTypeSchema).min(1),
  ...withSegment,
});
export type BossConfig = z.infer<typeof BossConfigSchema>;

export const ImageWordConfigSchema = z.object({
  characterId: z.string().uuid(),
  wordId: z.string().uuid(),
  distractorWordIds: z.array(z.string().uuid()).length(3),
  ...withSegment,
});
export type ImageWordConfig = z.infer<typeof ImageWordConfigSchema>;

// Boss is gated behind partial practice completion. Tune by editing this
// constant; the WeekHub UI and the boss route guard both read it.
export const BOSS_UNLOCK_PRACTICE_THRESHOLD = 7;

// Total practice scenes per week for full-size (N >= 10 chars) weeks.
// Smaller-N weeks scale down per compile-week.ts.
// image-scenes PR: 看图找字 bumped 1 → 3 → 15 (3 audio + 3 image_pick + 1
// lianliankan + 2 image_word + 6 meaning). PR #51: visual_pick retired (was 13/14).
export const PRACTICE_SCENE_COUNT = 15;

// Anti-avoidance rebalance (R3, 2026-07-06): the practice card is granted the
// moment the child's DISTINCT practice scenes cleared TODAY for a week reaches
// this threshold (cumulative across sessions — resumable), once per (week, day).
export const PRACTICE_CARD_DAILY_THRESHOLD = 8;
