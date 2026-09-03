/**
 * Stimulus validity for 看图找字 (`image_pick`) — decides which of a
 * character's own words may serve as the picture the scene asks about.
 *
 * David played week 7 and hit a scene showing balloons for 七 with the wrong
 * number of balloons. Investigation (2026-08-23,
 * docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md) found
 * the picture had never been checked for whether it CAN identify its answer —
 * `pickStimulusImage` (stimulus.ts) just grabbed "the first word with a URL".
 * Two disqualifiers came out of measuring the real corpus, both mechanical:
 *
 *   A. Count-dependent — the curriculum teaches exactly one number character
 *      per week, weeks 1-10 (一 二 三 四 五 六 七 八 九 十), and all 30 of
 *      their words hinge on an exact cardinality that diffusion art cannot
 *      render ("七个" wants exactly seven balloons; it gets "some"). The
 *      starkest case: 一起's hook is literally "two happy children holding
 *      hands" — for 一. These characters never pick a diffusion stimulus at
 *      all; see COUNTING_CHARS below. Task 3 (out of scope for this module)
 *      renders them procedurally instead — exactly N shapes, N = the
 *      character's own value, sourced from COUNTING_CHAR_VALUES so there is
 *      one map instead of two copies drifting apart.
 *
 *   B. Ambiguous — ten words are linked to TWO characters taught in the same
 *      week (唱歌 → 唱/歌, 多少 → 多/少, 大人 → 人/大, and seven more — see
 *      the design doc's table). Distractors for image_pick are drawn from
 *      that same week's character pool, so a scene could show the 唱歌
 *      picture, mark 唱 correct, and offer 歌 as a wrong-but-actually-right
 *      choice. There is no correct answer — worse than an inaccurate
 *      picture, an unanswerable one.
 *
 * Pure and client-safe: no `@/db`, no `@/lib/db/*`, no React, no randomness.
 * compile-week.ts calls `validStimulusWords` to choose which word to freeze
 * into `scene_config`; scene components import `COUNTING_CHARS` /
 * `COUNTING_CHAR_VALUES` directly to render the procedural counting card
 * instead of an `<img>`. (Both of those are later tasks — this module only
 * ships the predicate.)
 */

/** Characters whose meaning IS a quantity — diffusion cannot render an exact count. */
export const COUNTING_CHARS: ReadonlySet<string> = new Set([
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
]);

export function isCountingChar(hanzi: string): boolean {
  return COUNTING_CHARS.has(hanzi);
}

/**
 * Numeric value per counting character — the single source of truth for how
 * many objects a counting character's procedural stimulus should draw.
 * `COUNTING_CHARS` and this map are kept in lockstep by construction (same
 * ten keys); a test pins that invariant so the two can never silently drift.
 */
export const COUNTING_CHAR_VALUES: ReadonlyMap<string, number> = new Map([
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
  ['十', 10],
]);

/** A word this module can weigh as a candidate stimulus. */
export interface StimulusCandidate {
  wordId: string;
  text: string;
  imageUrl: string | null;
}

/**
 * word TEXT → the set of hanzi (in the given corpus) that own it.
 *
 * Powers `validStimulusWords`'s ambiguity check: a word linked to two
 * characters taught the same week (唱歌 -> 唱/歌, 多少 -> 多/少, 大人 -> 人/大,
 * ...) can't identify either one uniquely as an image_pick stimulus. Keyed
 * on hanzi, not characterId, to match `validStimulusWords`'s contract
 * exactly (`characters` is unique on `(hanzi, script)`, so the two are 1:1
 * and only `.size` is read here — but matching the contract means the next
 * reader does not have to re-derive that).
 *
 * Callers decide the corpus this is built over, and that choice matters:
 * `compile-week.ts` builds it once per compile from ALL of one week's
 * words, not just image_pick's own candidates — ownership is a property of
 * the whole week. 温故's review pool (`review/session.ts`) is cross-week by
 * definition, so building this per-week there would let the 唱歌 collision
 * (唱 correct, 歌 offered as a distractor, no right answer) return one week
 * over — the same shape of bug PR #158 fixed for the single-week case.
 *
 * Shared by both call sites so a future fix to one can't silently miss the
 * other — this function IS the ambiguity guard.
 */
export function buildWordOwners(
  chars: readonly { hanzi: string; words: readonly { text: string }[] }[],
): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const c of chars) {
    for (const w of c.words) {
      const set = owners.get(w.text) ?? new Set<string>();
      set.add(c.hanzi);
      owners.set(w.text, set);
    }
  }
  return owners;
}

/**
 * Words that may serve as an `image_pick` stimulus for `hanzi` this week.
 *
 * `wordOwners` maps word TEXT -> the set of hanzi (taught in the same week)
 * that word is linked to. A word owned by more than one character is
 * ambiguous (disqualifier B, above) no matter which of its owners is asking
 * — a word missing from the map, or mapped to a set of size ≤ 1, carries no
 * recorded ambiguity and is judged on `imageUrl` alone.
 *
 * A counting character (disqualifier A) returns `[]` unconditionally, even
 * if one of its words is otherwise perfectly clean. This is NOT "this
 * character has no picture" — it has one, just not a diffusion one; the
 * procedural counting card (a later task) is what actually renders for it.
 * Counting-character eligibility for the *scene slot itself* (i.e. does it
 * still get an image_pick at all) is handled by the caller, not here.
 */
export function validStimulusWords(
  hanzi: string,
  words: StimulusCandidate[],
  wordOwners: ReadonlyMap<string, ReadonlySet<string>>,
): StimulusCandidate[] {
  if (isCountingChar(hanzi)) return [];
  return words.filter((w) => {
    if (!w.imageUrl) return false;
    const owners = wordOwners.get(w.text);
    return !owners || owners.size <= 1;
  });
}
