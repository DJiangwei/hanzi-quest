import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sceneTemplates, weekLevels } from '@/db/schema';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import type {
  AudioPickConfig,
  BossConfig,
  FlashcardConfig,
  ImagePickConfig,
  PinyinPickConfig,
  Segment,
  SentenceClozeConfig,
  TranslatePickConfig,
  VisualPickConfig,
  WordMatchConfig,
} from './configs';
import { shuffle } from './sample';

type AnyConfig =
  | FlashcardConfig
  | AudioPickConfig
  | VisualPickConfig
  | ImagePickConfig
  | WordMatchConfig
  | PinyinPickConfig
  | TranslatePickConfig
  | SentenceClozeConfig
  | BossConfig;

/**
 * Translate a published week's characters into a sequence of `week_levels`
 * rows. PR #30 (4-segment structure):
 *   - review:  N flashcards (one per char, PDF order)
 *   - sound:   1 audio_pick + 1 pinyin_pick   (skipped if N < 2)
 *   - sight:   1 (image_pick if any imageHook else visual_pick) + 1 word_match
 *              (word_match only if >=2 chars have words; otherwise just sight scene)
 *   - meaning: 2 from { translate_pick, sentence_cloze }  with cloze->translate
 *              fallback per char if no example_sentence; alternates directions.
 *   - boss:    1 (only if N >= 10), 6 rotating question types.
 *
 * Idempotent — drops existing rows for the week before inserting.
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
    levelKey: string;
  }> = [];

  let position = 0;
  const push = (templateId: string, config: AnyConfig, segment: Segment) => {
    const pos = position++;
    rows.push({
      weekId,
      position: pos,
      sceneTemplateId: templateId,
      sceneConfig: { ...(config as Record<string, unknown>), segment },
      unlockedAfterPosition: null,
      levelKey: `${weekId}:${pos}`,
    });
  };

  // ── Segment 1: review ────────────────────────────────────────────────────
  for (const c of chars) {
    push(flashcardId, { characterId: c.id, hanzi: c.hanzi }, 'review');
  }

  // ── Segment 2: sound ─────────────────────────────────────────────────────
  if (chars.length >= 2) {
    const audioId = tmplByType.get('audio_pick');
    const pinyinId = tmplByType.get('pinyin_pick');
    if (audioId) {
      const target = pickRandom(chars);
      push(audioId, { characterId: target.id }, 'sound');
    }
    if (pinyinId) {
      const target = pickRandom(chars);
      push(pinyinId, { characterId: target.id }, 'sound');
    }
  }

  // ── Segment 3: sight ─────────────────────────────────────────────────────
  if (chars.length >= 2) {
    const imageId = tmplByType.get('image_pick');
    const visualId = tmplByType.get('visual_pick');
    const wordId = tmplByType.get('word_match');

    const withHook = chars.filter((c) => Boolean(c.imageHook));
    if (withHook.length > 0 && imageId) {
      const target = pickRandom(withHook);
      push(imageId, { characterId: target.id }, 'sight');
    } else if (visualId) {
      const target = pickRandom(chars);
      push(visualId, { characterId: target.id }, 'sight');
    }

    if (wordId) {
      const withWords = chars.filter((c) => c.words.length > 0);
      const sample = shuffle(withWords).slice(0, Math.min(4, withWords.length));
      if (sample.length >= 2) {
        push(wordId, { characterIds: sample.map((c) => c.id) }, 'sight');
      }
    }
  }

  // ── Segment 4: meaning ───────────────────────────────────────────────────
  if (chars.length >= 2) {
    const translateId = tmplByType.get('translate_pick');
    const clozeId = tmplByType.get('sentence_cloze');

    // Two "slots". Slot 0 = translate_pick (cn_to_en). Slot 1 = cloze if any
    // char has a sentence, else translate_pick (en_to_cn). Direction alternates.
    if (translateId) {
      const t1 = pickWithMeaning(chars);
      if (t1) {
        push(translateId, { characterId: t1.id, direction: 'cn_to_en' }, 'meaning');
      }
    }

    const withSentence = chars.filter((c) => c.sentence !== null);
    if (clozeId && withSentence.length > 0) {
      const target = pickRandom(withSentence);
      push(
        clozeId,
        { characterId: target.id, sentenceId: target.sentence!.id },
        'meaning',
      );
    } else if (translateId) {
      // Fallback: extra translate_pick (opposite direction)
      const t2 = pickWithMeaning(chars);
      if (t2) {
        push(translateId, { characterId: t2.id, direction: 'en_to_cn' }, 'meaning');
      }
    }
  }

  // ── Boss ─────────────────────────────────────────────────────────────────
  const bossId = tmplByType.get('boss');
  if (bossId && chars.length >= 10) {
    const shuffled = shuffle(chars).slice(0, 10);
    push(
      bossId,
      {
        characterIds: shuffled.map((c) => c.id),
        questionTypes: [
          'audio_pick',
          'visual_pick',
          'image_pick',
          'pinyin_pick',
          'translate_pick',
          'sentence_cloze',
        ],
      },
      'boss',
    );
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

function pickWithMeaning<T extends { meaningEn: string | null }>(
  arr: T[],
): T | null {
  const withMeaning = arr.filter((c) => Boolean(c.meaningEn));
  if (withMeaning.length === 0) return null;
  return pickRandom(withMeaning);
}
