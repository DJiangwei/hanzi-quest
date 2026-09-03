// A2 温故 — pure session builder (client-safe, no db imports).
//
// Questions are built at REQUEST time: no week_levels rows, no scene_templates
// row, no compile step, and therefore no recompile-all-weeks.ts post-merge.
import { buildWordOwners, validStimulusWords } from '@/lib/scenes/stimulus-validity';
import type { ReviewCandidate } from './selection';

// Re-exported for backwards compat — this module used to define its own
// copy (F4, final-review fix round: the compile-week.ts and session.ts
// copies were identical bodies and had drifted apart from each other's doc
// comments; both now import the single definition in stimulus-validity.ts,
// beside validStimulusWords, which IS the ambiguity guard).
export { buildWordOwners };

export interface ReviewPoolWord {
  wordId: string;
  text: string;
  imageUrl: string | null;
}

export interface ReviewPoolChar {
  characterId: string;
  hanzi: string;
  meaningEn: string | null;
  /** All readings, tones included — see `pinyinClash` below. */
  pinyin: string[];
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
 * Do two characters CLASH — could the device TTS reading of one also be read
 * as the other, so an `audio_pick` choice would be correct twice over?
 *
 * Compared WITH tones: mā and mà sound different and TTS renders them
 * differently, so only an exact match (after `trim().toLowerCase()`) counts.
 * The real corpus has four such pairs, all cross-week — 阳/羊, 木/目, 石/十,
 * 有/友 — which is exactly why a per-week `AudioPickScene` never hit this and
 * 温故's cross-week pool does (F1, final-review fix round).
 */
function pinyinClash(a: readonly string[], b: readonly string[]): boolean {
  const normalize = (p: string) => p.trim().toLowerCase();
  const aSet = new Set(a.map(normalize));
  return b.some((p) => aSet.has(normalize(p)));
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
 *   audio_pick     — >= 3 other characters that don't CLASH on pinyin (see
 *                    pinyinClash) — a homophone distractor would be correct
 *                    twice over
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

    // A homophone offered as a distractor is correct twice over — see
    // pinyinClash. Only eligible when enough non-clashing others remain.
    const nonHomophones = others.filter((c) => !pinyinClash(char.pinyin, c.pinyin));
    if (nonHomophones.length >= CHOICE_COUNT - 1) {
      types.push('audio_pick');
    }

    if (types.length === 0) return;
    const type = types[Math.floor(rng() * types.length)];

    const distractorPool =
      type === 'translate_pick'
        ? others.filter((c) => c.meaningEn && c.meaningEn !== char.meaningEn)
        : type === 'audio_pick'
          ? nonHomophones
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
