import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sceneTemplates, weekLevels } from '@/db/schema';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import type {
  AudioPickConfig,
  BossConfig,
  FlashcardConfig,
  ImagePickConfig,
  VisualPickConfig,
  WordMatchConfig,
} from './configs';
import { shuffle } from './sample';

/**
 * Translate a published week's characters into a sequence of `week_levels`
 * rows. V2 (Phase 3 full): one flashcard per character (review pass) followed
 * by a small mixed quiz block — audio pick, visual pick, image pick (if any
 * character has an imageHook), and a word match round. Total ≈ 13-14 levels.
 *
 * Idempotent — drops existing rows for the week before inserting the new
 * sequence, so re-publishing safely upgrades older 10-flashcard weeks.
 */
export async function compileWeekIntoLevels(weekId: string): Promise<number> {
  const chars = await getCharactersWithDetailsForWeek(weekId);
  if (chars.length === 0) {
    throw new Error(`Week ${weekId} has no characters to compile`);
  }

  const templates = await db
    .select({ id: sceneTemplates.id, type: sceneTemplates.type })
    .from(sceneTemplates)
    .where(eq(sceneTemplates.isActive, true));

  const tmplByType = new Map(templates.map((t) => [t.type, t.id]));
  const flashcardId = tmplByType.get('flashcard');
  if (!flashcardId) {
    throw new Error('No active flashcard scene_template — run the seed migration');
  }

  const rows: Array<{
    weekId: string;
    position: number;
    sceneTemplateId: string;
    sceneConfig: Record<string, unknown>;
    unlockedAfterPosition: number | null;
  }> = [];

  let position = 0;
  const push = (
    templateId: string,
    config:
      | FlashcardConfig
      | AudioPickConfig
      | VisualPickConfig
      | ImagePickConfig
      | WordMatchConfig
      | BossConfig,
  ) => {
    rows.push({
      weekId,
      position: position++,
      sceneTemplateId: templateId,
      sceneConfig: config as Record<string, unknown>,
      unlockedAfterPosition: null,
    });
  };

  // 1. One flashcard per character, in PDF order.
  for (const c of chars) {
    push(flashcardId, { characterId: c.id, hanzi: c.hanzi });
  }

  // 2. Quiz block — only if we have ≥ 2 characters (need distractors).
  if (chars.length >= 2) {
    const audioId = tmplByType.get('audio_pick');
    if (audioId) {
      const target = pickRandom(chars);
      push(audioId, { characterId: target.id });
    }

    const visualId = tmplByType.get('visual_pick');
    if (visualId) {
      const target = pickRandom(chars);
      push(visualId, { characterId: target.id });
    }

    const imageId = tmplByType.get('image_pick');
    if (imageId) {
      const withHook = chars.filter((c) => Boolean(c.imageHook));
      if (withHook.length > 0) {
        const target = pickRandom(withHook);
        push(imageId, { characterId: target.id });
      }
    }

    const wordId = tmplByType.get('word_match');
    if (wordId) {
      const withWords = chars.filter((c) => c.words.length > 0);
      const sample = shuffle(withWords).slice(0, Math.min(4, withWords.length));
      if (sample.length >= 2) {
        push(wordId, { characterIds: sample.map((c) => c.id) });
      }
    }
  }

  // 3. Boss — only if pack has at least 10 chars AND a boss template is seeded.
  const bossId = tmplByType.get('boss');
  if (bossId && chars.length >= 10) {
    const shuffled = shuffle(chars).slice(0, 10);
    push(bossId, {
      characterIds: shuffled.map((c) => c.id),
      questionTypes: ['audio_pick', 'visual_pick', 'image_pick'],
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(weekLevels).where(eq(weekLevels.weekId, weekId));
    if (rows.length > 0) {
      await tx.insert(weekLevels).values(rows);
    }
  });

  return rows.length;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
