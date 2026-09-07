// PURE — no '@/db' import. Safe to import from client components (PackPageBody)
// and server code alike.

export interface StudyCardLite {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  imageUrl: string | null;
}

/**
 * All three directions are picture ↔ Chinese. English is deliberately not a
 * question type: the point of this lesson is reading and hearing 中文, and a
 * question answerable from the English gloss tests nothing.
 */
export type StudyQuestionType = 'picture_to_word' | 'word_to_picture' | 'audio_to_picture';

export interface StudyQuestion {
  id: string;
  type: StudyQuestionType;
  target: StudyCardLite;
  /** Includes the target; already shuffled. */
  choices: StudyCardLite[];
}

/**
 * Cards a child must own in a pack before its lesson unlocks.
 *
 * Equal to the lesson size on purpose. Below it the lesson used to CYCLE its
 * targets — `shuffledOwned[i % length]` — so a pack with three owned cards
 * asked about each of them twice, and the repeat was obvious enough that David
 * reported it as a bug. Rather than shrink the lesson silently, the entry point
 * waits until there is enough material for six distinct questions.
 */
export const STUDY_MIN_OWNED = 6;
export const STUDY_LESSON_SIZE = 6;
export const STUDY_CHOICE_COUNT = 4;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a study lesson from a child's OWNED cards in a pack.
 *
 * Targets are DISTINCT — never cycled. Distractors come from `pool` (all pack
 * items, owned or not, so a small collection still gets four plausible
 * choices). Pure: inject `rng` for deterministic tests. Returns [] below
 * STUDY_MIN_OWNED.
 */
export function buildStudyLesson(
  owned: StudyCardLite[],
  pool: StudyCardLite[],
  rng: () => number = Math.random,
  size = STUDY_LESSON_SIZE,
): StudyQuestion[] {
  if (owned.length < STUDY_MIN_OWNED) return [];

  // DISTINCT targets. The old `i % length` wrap meant a pack with three owned
  // cards asked about each twice; a short lesson is fine, a repeated one is a
  // bug the child notices immediately.
  const targets = shuffle(owned, rng).slice(0, size);

  const types: StudyQuestionType[] = ['picture_to_word', 'word_to_picture', 'audio_to_picture'];
  return targets.map((target, i) => {
    const type = types[Math.floor(rng() * types.length)];
    const distractors = shuffle(pool.filter((c) => c.id !== target.id), rng).slice(0, STUDY_CHOICE_COUNT - 1);
    const choices = shuffle([target, ...distractors], rng);
    return { id: `${type}:${target.id}:${i}`, type, target, choices };
  });
}
