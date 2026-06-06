/** Cumulative XP needed to REACH level L. cumXp(L) = 50(L-1) + 25(L-1)(L-2). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, level);
  return 50 * (n - 1) + 25 * (n - 1) * (n - 2);
}

/** Highest level whose threshold is ≤ totalXp (level ≥ 1). */
export function levelForXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export interface LevelTitle { zh: string; en: string; }
export function titleForLevel(level: number): LevelTitle {
  if (level <= 2) return { zh: '见习水手', en: 'Cabin Boy' };
  if (level <= 4) return { zh: '水手', en: 'Sailor' };
  if (level <= 7) return { zh: '副船长', en: 'First Mate' };
  if (level <= 11) return { zh: '船长', en: 'Captain' };
  if (level <= 15) return { zh: '航海家', en: 'Navigator' };
  return { zh: '海洋大师', en: 'Sea Master' };
}
