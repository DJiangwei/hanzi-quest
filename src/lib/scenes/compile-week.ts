import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { sceneTemplates, weekLevels } from '@/db/schema';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import type { FlashcardConfig } from './configs';

/**
 * Translate a published week's characters into a sequence of `week_levels`
 * rows. V1: one flashcard per character, in PDF/parent order. Boss + the
 * other four scene types come in later PRs without changing this contract.
 *
 * Idempotent — drops any existing rows for the week before inserting the
 * new sequence so re-publishing a week is safe.
 */
export async function compileWeekIntoLevels(weekId: string): Promise<number> {
  const chars = await getCharactersWithDetailsForWeek(weekId);
  if (chars.length === 0) {
    throw new Error(`Week ${weekId} has no characters to compile`);
  }

  const [flashcardTemplate] = await db
    .select({ id: sceneTemplates.id })
    .from(sceneTemplates)
    .where(
      and(
        eq(sceneTemplates.type, 'flashcard'),
        eq(sceneTemplates.isActive, true),
      ),
    )
    .limit(1);

  if (!flashcardTemplate) {
    throw new Error('No active flashcard scene_template — run the seed migration');
  }

  await db.transaction(async (tx) => {
    await tx.delete(weekLevels).where(eq(weekLevels.weekId, weekId));

    await tx.insert(weekLevels).values(
      chars.map((c, idx) => ({
        weekId,
        position: idx,
        sceneTemplateId: flashcardTemplate.id,
        sceneConfig: {
          characterId: c.id,
          hanzi: c.hanzi,
        } satisfies FlashcardConfig,
        unlockedAfterPosition: null,
      })),
    );
  });

  return chars.length;
}
