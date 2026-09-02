// A2 温故 — pure session builder (client-safe, no db imports).
//
// Questions are built at REQUEST time: no week_levels rows, no scene_templates
// row, no compile step, and therefore no recompile-all-weeks.ts post-merge.
import { validStimulusWords } from '@/lib/scenes/stimulus-validity';
import type { ReviewCandidate } from './selection';

export interface ReviewPoolWord {
  wordId: string;
  text: string;
  imageUrl: string | null;
}

export interface ReviewPoolChar {
  characterId: string;
  hanzi: string;
  meaningEn: string | null;
  words: ReviewPoolWord[];
}

export type ReviewQuestionType = 'translate_pick' | 'audio_pick' | 'image_pick';

export interface ReviewQuestion {
  id: string;
  type: ReviewQuestionType;
  targetCharacterId: string;
  /** image_pick only: the word whose picture is shown, frozen at build time. */
  stimulusWordId: string | null;
  /** Includes the target. Shuffled. */
  choiceCharacterIds: string[];
}

const CHOICE_COUNT = 4;

/**
 * word text → the set of HANZI in the pool that own it.
 *
 * Keyed on hanzi, not characterId, to match `validStimulusWords`' documented
 * contract exactly. (`characters` is unique on `(hanzi, script)`, so the two
 * are 1:1 and only `.size` is read — but matching the contract means the next
 * reader does not have to re-derive that.)
 *
 * Built over the ENTIRE review pool, not one week. `validStimulusWords`
 * (PR #158) rejects a stimulus word shared with another character *in the pool
 * distractors are drawn from*; 温故's pool is cross-week by definition, so a
 * map built per-week would let the 唱歌 collision (唱 correct, 歌 offered as a
 * distractor, no right answer) return one week over.
 */
export function buildWordOwners(
  pool: ReviewPoolChar[],
): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const char of pool) {
    for (const w of char.words) {
      const set = owners.get(w.text) ?? new Set<string>();
      set.add(char.hanzi);
      owners.set(w.text, set);
    }
  }
  return owners;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one question per target, dropping any target the pool cannot support.
 *
 * Type eligibility, all judged AGAINST THE CROSS-WEEK POOL:
 *   translate_pick — target has meaningEn; >= 3 others with a different one
 *   audio_pick     — >= 3 other characters (device TTS: correct by construction)
 *   image_pick     — a VALID stimulus word (see buildWordOwners); >= 3 others
 */
export function buildReviewSession(
  targets: ReviewCandidate[],
  pool: ReviewPoolChar[],
  rng: () => number = Math.random,
): ReviewQuestion[] {
  const byId = new Map(pool.map((c) => [c.characterId, c]));
  const wordOwners = buildWordOwners(pool);
  const questions: ReviewQuestion[] = [];

  targets.forEach((t, index) => {
    const char = byId.get(t.characterId);
    if (!char) return;

    const others = pool.filter((c) => c.characterId !== char.characterId);
    if (others.length < CHOICE_COUNT - 1) return;

    const types: ReviewQuestionType[] = [];

    // A picture that cannot identify its own answer is worse than no picture.
    const validWords = validStimulusWords(
      char.hanzi,
      char.words.map((w) => ({ wordId: w.wordId, text: w.text, imageUrl: w.imageUrl })),
      wordOwners,
    );
    if (validWords.length > 0) types.push('image_pick');

    if (
      char.meaningEn &&
      others.filter((c) => c.meaningEn && c.meaningEn !== char.meaningEn).length >=
        CHOICE_COUNT - 1
    ) {
      types.push('translate_pick');
    }

    types.push('audio_pick');

    const type = types[Math.floor(rng() * types.length)] ?? 'audio_pick';

    const distractorPool =
      type === 'translate_pick'
        ? others.filter((c) => c.meaningEn && c.meaningEn !== char.meaningEn)
        : others;
    const distractors = shuffle(distractorPool, rng).slice(0, CHOICE_COUNT - 1);
    if (distractors.length < CHOICE_COUNT - 1) return;

    questions.push({
      id: `${type}:${char.characterId}:${index}`,
      type,
      targetCharacterId: char.characterId,
      stimulusWordId: type === 'image_pick' ? validWords[0].wordId : null,
      choiceCharacterIds: shuffle(
        [char.characterId, ...distractors.map((d) => d.characterId)],
        rng,
      ),
    });
  });

  return questions;
}
