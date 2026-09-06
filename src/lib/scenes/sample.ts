/**
 * Pick `count` random distinct items from `pool` excluding `exclude`.
 * Caller is responsible for `pool` having enough items.
 */
export function sampleDistractors<T>(
  pool: T[],
  exclude: T,
  count: number,
  eq: (a: T, b: T) => boolean = (a, b) => a === b,
): T[] {
  const candidates = pool.filter((p) => !eq(p, exclude));
  return shuffle(candidates).slice(0, count);
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * How many of a question's wrong options come from ALREADY-CLEARED weeks
 * rather than the week being taught (A2 slice 1).
 *
 * One, not more. Recognition only counts when it happens under interference,
 * so a familiar-only option set teaches less than it looks like it does — but
 * this game deliberately softens 畏难情绪, and a question where three of four
 * options are unfamiliar is a harder game than the one she agreed to play.
 * One stale option per question is passive re-exposure she never has to opt
 * into; GAME-DESIGN §9 estimates it buys ~80% of a review system's value.
 */
export const STALE_DISTRACTORS_PER_QUESTION = 1;

/**
 * How many of a question's wrong options are chosen to be CONFUSABLE with the
 * answer rather than random (V2 slice 1).
 *
 * One, for the same reason only one comes from an older week: three hard
 * options out of four is a different, harder game than the one she agreed to
 * play, and this product softens 畏难情绪 deliberately everywhere else.
 */
export const CONFUSABLE_DISTRACTORS_PER_QUESTION = 1;

export interface ConfusableSpec<T> {
  /**
   * True when `candidate` is a deliberately confusable wrong option for
   * `target`. Kept as a caller-supplied predicate so this module never learns
   * about pinyin: what counts as confusable is a property of the QUESTION, not
   * of the sampler. A tone neighbour is a real distractor when the stimulus is
   * a sound and irrelevant when it is a picture.
   */
  isConfusable: (candidate: T, target: T) => boolean;
  count?: number;
}

/**
 * Pick `count` distractors, `fromOlder` of them drawn from previously-cleared
 * weeks and the rest from the week being taught.
 *
 * Degrades in both directions rather than throwing, because both thin cases
 * are real: week 1 of map 1 has no older pool at all, and an 8-character week
 * can leave too few same-week options once the target and any word-sharing
 * character are excluded. A short option list is a poor question; an exception
 * thrown mid-practice is a broken one.
 */
export function blendDistractors<T>(
  weekPool: readonly T[],
  olderPool: readonly T[],
  exclude: T,
  count: number,
  fromOlder: number = STALE_DISTRACTORS_PER_QUESTION,
  eq: (a: T, b: T) => boolean = (a, b) => a === b,
  confusable?: ConfusableSpec<T>,
): T[] {
  const week = weekPool.filter((p) => !eq(p, exclude));
  const older = olderPool.filter(
    (p) => !eq(p, exclude) && !week.some((w) => eq(w, p)),
  );

  const olderWanted = Math.min(fromOlder, count, older.length);
  const picked = shuffle(older).slice(0, olderWanted);

  // V2 slice 1: reserve one slot for a genuinely confusable option, drawn from
  // EITHER pool. Optional and best-effort — most characters have no confusable
  // neighbour in her corpus at all (82 of 176 do), and a question missing one
  // is simply the pre-V2 question, not a broken one.
  if (confusable) {
    const wanted = confusable.count ?? CONFUSABLE_DISTRACTORS_PER_QUESTION;
    const taken = new Set(picked);
    const candidates = [...week, ...older].filter(
      (c) => !taken.has(c) && confusable.isConfusable(c, exclude),
    );
    picked.push(...shuffle(candidates).slice(0, Math.max(0, Math.min(wanted, count - picked.length))));
  }

  const chosen = new Set(picked);
  picked.push(...shuffle(week.filter((w) => !chosen.has(w))).slice(0, count - picked.length));

  // The week could not fill its share — top up from whatever older material
  // is left rather than returning a two-option question.
  if (picked.length < count) {
    const used = new Set(picked);
    picked.push(
      ...shuffle(older.filter((o) => !used.has(o))).slice(0, count - picked.length),
    );
  }
  return picked;
}
