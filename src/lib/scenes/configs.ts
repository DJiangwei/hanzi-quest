import { z } from 'zod';

export const FlashcardConfigSchema = z.object({
  characterId: z.string().uuid(),
  hanzi: z.string().min(1).max(2),
});
export type FlashcardConfig = z.infer<typeof FlashcardConfigSchema>;
