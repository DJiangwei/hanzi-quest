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
  imageHook: z
    .string()
    .min(3)
    .max(120)
    .describe(
      "A child-friendly, single-subject visual description of this word's meaning. " +
        'Vivid and concrete; like a caption you\'d write under a picture. ' +
        'No proper nouns, no text in scene. e.g. for 大人: ' +
        '"a smiling adult standing next to a small child"; ' +
        'for 亮晶晶: "tiny stars sparkling in the night sky".',
    ),
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

// V2 is structurally identical to V1 post-extension (imageHook added to Word).
// Alias kept so generate-content.ts can reference the current schema by version.
export const WeekContentSchemaV2 = WeekContentSchemaV1;

export type PerCharacter = z.infer<typeof PerCharacterSchema>;
export type WeekContent = z.infer<typeof WeekContentSchemaV1>;
