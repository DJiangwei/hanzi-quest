// PURE — no '@/db' import. Safe to import from client components (PackPageBody)
// and server code alike.

export interface StudyCardLite {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  imageUrl: string | null;
}

export type StudyQuestionType = 'picture_to_word' | 'audio_to_picture';

export interface StudyQuestion {
  id: string;
  type: StudyQuestionType;
  target: StudyCardLite;
  /** Includes the target; already shuffled. */
  choices: StudyCardLite[];
}

export const STUDY_MIN_OWNED = 3;
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
 * Build a study lesson from a child's OWNED cards in a pack. Targets are drawn
 * from `owned` (cycled if fewer than `size`); distractors come from `pool` (all
 * pack items). Pure: inject `rng` for deterministic tests. Returns [] if the
 * child owns fewer than STUDY_MIN_OWNED.
 */
export function buildStudyLesson(
  owned: StudyCardLite[],
  pool: StudyCardLite[],
  rng: () => number = Math.random,
  size = STUDY_LESSON_SIZE,
): StudyQuestion[] {
  if (owned.length < STUDY_MIN_OWNED) return [];

  const shuffledOwned = shuffle(owned, rng);
  const targets: StudyCardLite[] = [];
  for (let i = 0; i < size; i++) targets.push(shuffledOwned[i % shuffledOwned.length]);

  const types: StudyQuestionType[] = ['picture_to_word', 'audio_to_picture'];
  return targets.map((target, i) => {
    const type = types[Math.floor(rng() * types.length)];
    const distractors = shuffle(pool.filter((c) => c.id !== target.id), rng).slice(0, STUDY_CHOICE_COUNT - 1);
    const choices = shuffle([target, ...distractors], rng);
    return { id: `${type}:${target.id}:${i}`, type, target, choices };
  });
}
