import { z } from 'zod';

export const HOMEWORK_TYPES = ['char_quiz', 'word_building', 'sentence_order'] as const;
export type HomeworkType = (typeof HOMEWORK_TYPES)[number];

const charQuizConfig = z
  .object({
    hanzi: z.string().trim().min(1).max(4).optional(),
    questionZh: z.string().trim().min(1),
    options: z
      .array(z.object({ textZh: z.string().trim().min(1), textEn: z.string().trim().min(1) }))
      .min(2)
      .max(4),
    correctIndex: z.number().int().min(0),
  })
  .refine((c) => c.correctIndex < c.options.length, {
    message: 'correctIndex out of range',
    path: ['correctIndex'],
  });

const wordBuildingConfig = z.object({
  baseChar: z.string().trim().min(1).max(2),
  correctWord: z.string().trim().min(1),
  distractors: z.array(z.string().trim().min(1)).min(1).max(5),
  correctMeaningEn: z.string().trim().min(1).optional(),
});

const sentenceOrderConfig = z.object({
  tokens: z.array(z.string().trim().min(1)).min(2).max(12),
  translationEn: z.string().trim().min(1).optional(),
});

export type CharQuizConfig = z.infer<typeof charQuizConfig>;
export type WordBuildingConfig = z.infer<typeof wordBuildingConfig>;
export type SentenceOrderConfig = z.infer<typeof sentenceOrderConfig>;

export type HomeworkItemConfig =
  | ({ type: 'char_quiz' } & CharQuizConfig)
  | ({ type: 'word_building' } & WordBuildingConfig)
  | ({ type: 'sentence_order' } & SentenceOrderConfig);

/** Validate raw config for a type; throws ZodError on bad shape. */
export function parseHomeworkConfig(type: HomeworkType, raw: unknown): HomeworkItemConfig {
  switch (type) {
    case 'char_quiz':
      return { type, ...charQuizConfig.parse(raw) };
    case 'word_building':
      return { type, ...wordBuildingConfig.parse(raw) };
    case 'sentence_order':
      return { type, ...sentenceOrderConfig.parse(raw) };
  }
}
