// E2 — tone practice. PURE and client-safe: no `@/db`, no React, no randomness
// beyond the shuffle the caller seeds.
//
// Every question is built from characters the child has already been taught, so
// the meanings are known and the ONLY variable is the tone. That also makes the
// question bank grow by itself: each new week adds syllables that may collide
// with ones she already has.

/**
 * The MOST characters a question may offer — a cap, not a target.
 *
 * Measured against production on 2026-09-05: across all 176 characters she has
 * been taught, NOT ONE syllable is known in four different tones, and only one
 * (ěr / ér / èr) is known in three. Eleven of the twelve groups in map 1 and
 * all eight in map 2 hold exactly two. A builder that treats four as a quota
 * therefore invents two options per question, every question — which is
 * precisely what the first version did.
 */
export const TONE_MAX_CHOICES = 4;

const TONE_ROWS = [
  ['āēīōūǖ', 1],
  ['áéíóúǘ', 2],
  ['ǎěǐǒǔǚ', 3],
  ['àèìòùǜ', 4],
] as const;

/** Marked vowels, positionally aligned with every row of TONE_ROWS. */
const BARE_VOWELS = 'aeiouv';
const BARE: Record<string, string> = {};
for (const [marks] of TONE_ROWS) {
  [...marks].forEach((ch, i) => {
    BARE[ch] = BARE_VOWELS[i];
  });
}

/** 1–4, or 5 for an unmarked (neutral) syllable. */
export function toneOf(pinyin: string): number {
  for (const ch of pinyin) {
    for (const [marks, tone] of TONE_ROWS) {
      if (marks.includes(ch)) return tone;
    }
  }
  return 5;
}

/** The syllable with its tone mark removed, so 妈 and 马 collide on `ma`. */
export function toneless(pinyin: string): string {
  return [...pinyin].map((ch) => BARE[ch] ?? ch).join('');
}

export interface ToneChar {
  characterId: string;
  hanzi: string;
  pinyin: string[];
}

export interface ToneCandidate {
  characterId: string;
  hanzi: string;
  pinyin: string;
  tone: number;
}

export interface ToneQuestion {
  id: string;
  answer: ToneCandidate;
  /** Includes the answer. Caller shuffles for display. */
  choices: ToneCandidate[];
}

function candidates(chars: ToneChar[]): ToneCandidate[] {
  return chars
    .filter((c) => c.pinyin.length > 0 && c.pinyin[0])
    .map((c) => ({
      characterId: c.characterId,
      hanzi: c.hanzi,
      pinyin: c.pinyin[0],
      tone: toneOf(c.pinyin[0]),
    }));
}

/**
 * Syllables she knows in more than one tone.
 *
 * A group needs at least two DISTINCT tones, not merely two characters: 十 and
 * 石 are both `shí`, so a question offering both has two correct answers by ear
 * — worse than no question at all. Such a group still qualifies if some third
 * character supplies a real contrast; it is the question builder's job never to
 * put two identical sounds in one question.
 */
export function groupMinimalPairs(chars: ToneChar[]): ToneCandidate[][] {
  const bySyllable = new Map<string, ToneCandidate[]>();
  for (const c of candidates(chars)) {
    const key = toneless(c.pinyin);
    bySyllable.set(key, [...(bySyllable.get(key) ?? []), c]);
  }
  return [...bySyllable.values()].filter(
    (group) => new Set(group.map((c) => c.tone)).size > 1,
  );
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build up to `count` questions. A question is a character to hear plus every
 * OTHER tone of that same syllable she knows — two options, sometimes three.
 *
 * **Never pad to a fixed option count.** The first version topped up short
 * questions with characters from anywhere, and the padding did not merely fail
 * to help: an option that shares no syllable with the answer is eliminable by
 * reading, so a 4-option question with two fillers is EASIER than the honest
 * 2-option one, and it rewards scanning for the familiar shape — the opposite
 * of the discrimination being trained. Worse, the old code then dropped any
 * pair it could not pad to four, discarding the purest contrasts in the corpus.
 *
 * A two-way question is a 50% guess, and that is accepted: this is the standard
 * shape of a minimal-pair discrimination drill, and no reward anywhere depends
 * on the answer.
 *
 * Three invariants the tests pin, each of which would silently ruin the game:
 *   • every choice shares the answer's syllable, or the question tests reading;
 *   • no two choices may SOUND the same, or listening cannot separate them;
 *   • a question offers at least two, so there is something to discriminate.
 */
export function buildToneQuestions(
  chars: ToneChar[],
  count: number,
  rng: () => number = Math.random,
): ToneQuestion[] {
  const groups = groupMinimalPairs(chars);
  if (groups.length === 0) return [];

  const usedAnswers = new Set<string>();
  const bySyllable: ToneQuestion[][] = [];

  for (const group of shuffle(groups, rng)) {
    const built: ToneQuestion[] = [];
    for (const answer of shuffle(group, rng)) {
      if (usedAnswers.has(answer.hanzi)) continue;

      // Same syllable, DIFFERENT sound — the contrast being taught.
      const sameSyllable = group.filter((c) => c.pinyin !== answer.pinyin);
      if (sameSyllable.length === 0) continue;

      // Only the answer's own syllable. `sameSyllable` is non-empty here, so a
      // question always ends with the answer plus at least one real contrast —
      // there is no short-question case left to top up.
      const chosen = [answer];
      const soundsUsed = new Set([answer.pinyin]);
      for (const c of shuffle(sameSyllable, rng)) {
        if (chosen.length >= TONE_MAX_CHOICES) break;
        if (soundsUsed.has(c.pinyin)) continue;
        chosen.push(c);
        soundsUsed.add(c.pinyin);
      }

      usedAnswers.add(answer.hanzi);
      built.push({ id: `tone:${answer.characterId}`, answer, choices: chosen });
    }
    if (built.length > 0) bySyllable.push(built);
  }

  // Deal one question from each syllable in turn, rather than emptying a
  // syllable before moving on. Since most groups hold exactly two characters,
  // the straightforward nesting showed the SAME two tiles twice in a row with
  // only the correct one swapped — which reads as a stuck screen rather than a
  // second question, and lets the second answer be inferred from the first.
  const questions: ToneQuestion[] = [];
  for (let depth = 0; questions.length < count; depth++) {
    let dealt = false;
    for (const built of bySyllable) {
      if (questions.length >= count) break;
      const q = built[depth];
      if (!q) continue;
      questions.push(q);
      dealt = true;
    }
    if (!dealt) break;
  }
  return questions;
}
