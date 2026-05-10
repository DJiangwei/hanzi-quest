import { z } from 'zod';

export const FlashcardConfigSchema = z.object({
  characterId: z.string().uuid(),
  hanzi: z.string().min(1).max(2),
});
export type FlashcardConfig = z.infer<typeof FlashcardConfigSchema>;

export const AudioPickConfigSchema = z.object({
  characterId: z.string().uuid(),
});
export type AudioPickConfig = z.infer<typeof AudioPickConfigSchema>;

export const VisualPickConfigSchema = z.object({
  characterId: z.string().uuid(),
});
export type VisualPickConfig = z.infer<typeof VisualPickConfigSchema>;

export const ImagePickConfigSchema = z.object({
  characterId: z.string().uuid(),
});
export type ImagePickConfig = z.infer<typeof ImagePickConfigSchema>;

export const WordMatchConfigSchema = z.object({
  characterIds: z.array(z.string().uuid()).min(2).max(6),
});
export type WordMatchConfig = z.infer<typeof WordMatchConfigSchema>;
