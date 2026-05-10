import { z } from 'zod';

/**
 * Output of a single AI generation call covering one weekly batch of characters.
 *
 * Versioned: bump WeekContentSchemaV1 → V2 if the contract ever changes; keep
 * old versions around so we can re-validate historical ai_jobs rows.
 */

const ToneMarkedPinyin = z
  .string()
  .min(1)
  .max(8)
  .describe(
    'A single Mandarin syllable in tone-mark pinyin (e.g. "xué" not "xue2" or "xue3"). One entry per character of the surrounding text.',
  );

const PinyinArray = z.array(ToneMarkedPinyin).min(1);

const Word = z.object({
  word: z
    .string()
    .min(1)
    .max(8)
    .describe('Simplified Chinese word, 1–4 chars typical.'),
  pinyin: PinyinArray,
  meaningEn: z.string().min(1).max(80),
});

const Sentence = z.object({
  text: z
    .string()
    .min(2)
    .max(20)
    .describe(
      'A short example sentence in simplified Chinese, ≤ 12 characters. Must contain the target character.',
    ),
  pinyin: PinyinArray,
  meaningEn: z.string().min(1).max(120),
});

export const PerCharacterSchema = z.object({
  hanzi: z.string().min(1).max(2),
  pinyin: PinyinArray,
  meaningEn: z.string().min(1).max(80),
  meaningZh: z.string().min(1).max(40),
  words: z.array(Word).length(3),
  sentence: Sentence,
  imageHook: z
    .string()
    .min(3)
    .max(120)
    .describe(
      "A vivid, child-friendly image description anchoring the character's meaning. Used as a future image-gen prompt. e.g. for 山: 'a smiling green mountain with three peaks under blue sky'.",
    ),
});

export const WeekContentSchemaV1 = z.object({
  perCharacter: z.array(PerCharacterSchema),
});

export type PerCharacter = z.infer<typeof PerCharacterSchema>;
export type WeekContent = z.infer<typeof WeekContentSchemaV1>;
