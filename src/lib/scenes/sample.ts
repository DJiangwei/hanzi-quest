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
