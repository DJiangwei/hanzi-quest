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
): T[] {
  const week = weekPool.filter((p) => !eq(p, exclude));
  const older = olderPool.filter(
    (p) => !eq(p, exclude) && !week.some((w) => eq(w, p)),
  );

  const olderWanted = Math.min(fromOlder, count, older.length);
  const picked = shuffle(older).slice(0, olderWanted);
  picked.push(...shuffle(week).slice(0, count - picked.length));

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
