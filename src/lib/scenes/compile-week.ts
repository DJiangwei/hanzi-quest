import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sceneTemplates, weekLevels } from '@/db/schema';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import type {
  AudioPickConfig,
  BossConfig,
  FlashcardConfig,
  ImagePickConfig,
  ImageWordConfig,
  LianliankanConfig,
  Segment,
  SentenceClozeConfig,
  TranslatePickConfig,
  VisualPickConfig,
} from './configs';
import { shuffle } from './sample';

type AnyConfig =
  | FlashcardConfig
  | AudioPickConfig
  | VisualPickConfig
  | ImagePickConfig
  | ImageWordConfig
  | LianliankanConfig
  | TranslatePickConfig
  | SentenceClozeConfig
  | BossConfig;

/**
 * Translate a published week's characters into week_levels rows.
 *
 * PR #35 shape:
 *   review:   N × flashcard
 *   sound:    K × audio_pick (3 for N>=10; 2 for 4-9; 1 for 2-3; 0 for <2)
 *   sight:    image_pick + word_match (count scales same as sound)
 *   meaning:  translate_pick + sentence_cloze (alternating direction; cloze->translate fallback)
 *   boss:     1 × boss (N>=10), 5 rotating question types
 *
 * Upserts by (weekId, levelKey). Stable keys preserve scene_attempts.weekLevelId
 * across recompiles. Keys absent from the new compile are deleted at end-of-tx.
 *
 * pinyin_pick is intentionally absent — see PR #35 spec §3.3.
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

  type Row = {
    weekId: string;
    position: number;
    sceneTemplateId: string;
    sceneConfig: Record<string, unknown>;
    unlockedAfterPosition: number | null;
    levelKey: string;
  };
  const rows: Row[] = [];

  let position = 0;
  const push = (
    templateId: string,
    config: AnyConfig,
    segment: Segment,
    levelKey: string,
  ) => {
    rows.push({
      weekId,
      position: position++,
      sceneTemplateId: templateId,
      sceneConfig: { ...(config as Record<string, unknown>), segment },
      unlockedAfterPosition: null,
      levelKey,
    });
  };

  // ── REVIEW ──────────────────────────────────────────────────────────────
  for (const c of chars) {
    push(
      flashcardId,
      { characterId: c.id, hanzi: c.hanzi },
      'review',
      `review:flashcard:${c.id}`,
    );
  }

  const N = chars.length;
  const sizing = computePracticeSizing(N);

  // ── SOUND ───────────────────────────────────────────────────────────────
  if (sizing.audio > 0) {
    const audioId = tmplByType.get('audio_pick');
    if (audioId) {
      const audioChars = sampleN(chars, sizing.audio);
      audioChars.forEach((c, i) => {
        push(
          audioId,
          { characterId: c.id },
          'sound',
          `practice:audio_pick:${i}`,
        );
      });
    }
  }

  // ── SIGHT ───────────────────────────────────────────────────────────────
  if (sizing.sight > 0) {
    const imageId = tmplByType.get('image_pick');
    const usedCharIds = new Set<string>();

    // image_pick (slot 0): if any char has imageHook
    if (sizing.sight >= 1 && imageId) {
      const withHook = chars.filter((c) => Boolean(c.imageHook));
      if (withHook.length > 0) {
        const target = pickRandom(withHook);
        usedCharIds.add(target.id);
        push(
          imageId,
          { characterId: target.id },
          'sight',
          'practice:image_pick:0',
        );
      }
      // No visual_pick fallback in PR #51+. If no eligible char, slot stays unfilled.
    }

    // lianliankan (slot 1 — multi-char, exactly 4 chars with meaningEn)
    const lianliankanId = tmplByType.get('lianliankan');
    if (sizing.sight >= 2 && lianliankanId) {
      const withMeaning = chars.filter((c) => Boolean(c.meaningEn));
      const sample = shuffle(withMeaning).slice(0, 4);
      if (sample.length === 4) {
        push(
          lianliankanId,
          { characterIds: sample.map((c) => c.id) },
          'sight',
          'practice:lianliankan:0',
        );
      }
      // If fewer than 4 chars with meaningEn, slot stays unfilled.
      // word_match fallback intentionally NOT added — word_match is retired.
    }

    // ── SIGHT: image_word slots ────────────────────────────────────────────
    const imageWordId = tmplByType.get('image_word');
    if (imageWordId && sizing.imageWord > 0) {
      const eligibleChars = chars.filter((c) =>
        c.words.some((w) => w.imageHook !== null),
      );
      for (let slot = 0; slot < sizing.imageWord; slot++) {
        if (eligibleChars.length === 0) break;
        const target = pickRandom(eligibleChars);
        const eligibleWords = target.words.filter((w) => w.imageHook !== null);
        const correctWord = pickRandom(eligibleWords);
        const allOtherWords = chars
          .flatMap((c) => c.words.filter((w) => w.id !== correctWord.id))
          .map((w) => w.id);
        if (allOtherWords.length < 3) break;
        const distractors = shuffle(allOtherWords).slice(0, 3);
        push(
          imageWordId,
          { characterId: target.id, wordId: correctWord.id, distractorWordIds: distractors },
          'sight',
          `practice:image_word:${slot}`,
        );
      }
      // No visual_pick fallback for unfilled image_word slots in PR #51+.
    }
  }

  // ── MEANING ─────────────────────────────────────────────────────────────
  if (sizing.meaning > 0) {
    const translateId = tmplByType.get('translate_pick');
    const clozeId = tmplByType.get('sentence_cloze');
    const withMeaning = chars.filter((c) => Boolean(c.meaningEn));
    const withSentence = chars.filter((c) => c.sentence !== null);

    const translateTarget = Math.ceil(sizing.meaning / 2);
    const clozeTarget = sizing.meaning - translateTarget;

    // translate_pick slots
    if (translateId && withMeaning.length > 0) {
      for (let i = 0; i < translateTarget; i++) {
        const target = withMeaning[i % withMeaning.length];
        push(
          translateId,
          {
            characterId: target.id,
            direction: i % 2 === 0 ? 'cn_to_en' : 'en_to_cn',
          },
          'meaning',
          `practice:translate_pick:${i}`,
        );
      }
    }

    // sentence_cloze slots, falling back to extra translate_pick if not enough sentences
    let clozeFilled = 0;
    if (clozeId && withSentence.length > 0) {
      const sentenceChars = shuffle(withSentence);
      for (let i = 0; i < clozeTarget && i < sentenceChars.length; i++) {
        const target = sentenceChars[i];
        push(
          clozeId,
          { characterId: target.id, sentenceId: target.sentence!.id },
          'meaning',
          `practice:sentence_cloze:${i}`,
        );
        clozeFilled++;
      }
    }
    if (clozeFilled < clozeTarget && translateId && withMeaning.length > 0) {
      for (let i = clozeFilled; i < clozeTarget; i++) {
        const target = withMeaning[(translateTarget + i) % withMeaning.length];
        push(
          translateId,
          {
            characterId: target.id,
            direction: i % 2 === 0 ? 'en_to_cn' : 'cn_to_en',
          },
          'meaning',
          `practice:translate_pick:${translateTarget + i}`,
        );
      }
    }
  }

  // ── BOSS ────────────────────────────────────────────────────────────────
  const bossId = tmplByType.get('boss');
  if (bossId && N >= 10) {
    const shuffled = shuffle(chars).slice(0, 10);
    push(
      bossId,
      {
        characterIds: shuffled.map((c) => c.id),
        questionTypes: [
          'audio_pick',
          'visual_pick',
          'image_pick',
          'translate_pick',
          'sentence_cloze',
        ],
      },
      'boss',
      'boss:boss:0',
    );
  }

  // ── UPSERT + PRUNE ──────────────────────────────────────────────────────
  await db.transaction(async (tx) => {
    if (rows.length > 0) {
      await tx
        .insert(weekLevels)
        .values(rows)
        .onConflictDoUpdate({
          target: [weekLevels.weekId, weekLevels.levelKey],
          set: {
            position: sql`excluded.position`,
            sceneTemplateId: sql`excluded.scene_template_id`,
            sceneConfig: sql`excluded.scene_config`,
            unlockedAfterPosition: sql`excluded.unlocked_after_position`,
          },
        });
    }
    const keys = rows.map((r) => r.levelKey);
    if (keys.length > 0) {
      await tx
        .delete(weekLevels)
        .where(
          and(eq(weekLevels.weekId, weekId), notInArray(weekLevels.levelKey, keys)),
        );
    } else {
      await tx.delete(weekLevels).where(eq(weekLevels.weekId, weekId));
    }
  });

  return rows.length;
}

interface PracticeSizing {
  audio: number;
  sight: number;
  imageWord: number;
  meaning: number;
}

function computePracticeSizing(n: number): PracticeSizing {
  if (n < 2)  return { audio: 0, sight: 0, imageWord: 0, meaning: 0 };
  if (n < 4)  return { audio: 1, sight: 1, imageWord: 1, meaning: 4 };  // 7 practice
  if (n < 10) return { audio: 2, sight: 1, imageWord: 1, meaning: 6 };  // 10 practice
  return { audio: 3, sight: 2, imageWord: 2, meaning: 6 };              // 13 practice (was 14)
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleN<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return shuffle(arr);
  return shuffle(arr).slice(0, n);
}
