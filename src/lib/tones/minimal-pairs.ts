// E2 — tone practice. PURE and client-safe: no `@/db`, no React, no randomness
// beyond the shuffle the caller seeds.
//
// Every question is built from characters the child has already been taught, so
// the meanings are known and the ONLY variable is the tone. That also makes the
// question bank grow by itself: each new week adds syllables that may collide
// with ones she already has.

/** Characters offered per question. */
export const TONE_CHOICE_COUNT = 4;

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
 * Build up to `count` questions, each a character to hear and four to choose
 * from.
 *
 * Two invariants the tests pin, both of which would silently ruin the game:
 *   • no two choices may SOUND the same, or listening cannot separate them;
 *   • at least one distractor comes from the answer's own syllable, or the
 *     question tests reading rather than tone.
 */
export function buildToneQuestions(
  chars: ToneChar[],
  count: number,
  rng: () => number = Math.random,
): ToneQuestion[] {
  const groups = groupMinimalPairs(chars);
  if (groups.length === 0) return [];

  const all = candidates(chars);
  const questions: ToneQuestion[] = [];
  const usedAnswers = new Set<string>();

  for (const group of shuffle(groups, rng)) {
    for (const answer of shuffle(group, rng)) {
      if (questions.length >= count) return questions;
      if (usedAnswers.has(answer.hanzi)) continue;

      // Same syllable, DIFFERENT sound — the contrast being taught.
      const sameSyllable = group.filter((c) => c.pinyin !== answer.pinyin);
      if (sameSyllable.length === 0) continue;

      const chosen = [answer];
      const soundsUsed = new Set([answer.pinyin]);
      for (const c of shuffle(sameSyllable, rng)) {
        if (chosen.length >= TONE_CHOICE_COUNT) break;
        if (soundsUsed.has(c.pinyin)) continue;
        chosen.push(c);
        soundsUsed.add(c.pinyin);
      }
      // Top up from anywhere, still refusing a repeated sound.
      for (const c of shuffle(all, rng)) {
        if (chosen.length >= TONE_CHOICE_COUNT) break;
        if (soundsUsed.has(c.pinyin)) continue;
        chosen.push(c);
        soundsUsed.add(c.pinyin);
      }
      if (chosen.length < TONE_CHOICE_COUNT) continue;

      usedAnswers.add(answer.hanzi);
      questions.push({ id: `tone:${answer.characterId}`, answer, choices: chosen });
    }
  }
  return questions;
}
