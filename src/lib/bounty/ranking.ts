// T2 通缉令 — pure bounty-selection engine (client-safe, no db imports).
// First consumer of the A1 answer_events telemetry: posts the characters the
// child has never practiced (unseen — later weeks first) or gets wrong (weak).

export const BOUNTY_COUNT = 3;
export const BOUNTY_REQUIRED_HITS = 2;
export const BOUNTY_REWARD_COINS = 40;
export const BOUNTY_REWARD_XP = 10;
export const BOUNTY_COOLDOWN_DAYS = 3;

export interface BountyCandidate {
  characterId: string;
  hanzi: string;
  weekNumber: number;
  /** All-time answer_events rows targeting this char. */
  total: number;
  /** correct=false rows. */
  wrong: number;
  /** dont_know / not_sure self-ratings. */
  dontKnow: number;
}

/**
 * Score a candidate. 0 = never posted (she's fine on it).
 * Unseen chars (no telemetry at all) outrank every weak char, and later
 * weeks outrank earlier — that's the avoidance being targeted.
 */
export function bountyScore(c: BountyCandidate): number {
  if (c.total === 0) return 100 + c.weekNumber;
  const misses = c.wrong + c.dontKnow;
  if (misses === 0) return 0;
  return Math.round((60 * misses) / c.total) + c.weekNumber;
}

/**
 * Pick today's wanted characters: top `count` by score, excluding recently
 * posted chars (cooldown). Deterministic — ties break by weekNumber desc
 * (push toward later weeks), then hanzi for stability.
 */
export function pickBounties(
  candidates: BountyCandidate[],
  recentlyPostedCharIds: ReadonlySet<string>,
  count: number = BOUNTY_COUNT,
): BountyCandidate[] {
  return candidates
    .filter((c) => !recentlyPostedCharIds.has(c.characterId))
    .map((c) => ({ c, score: bountyScore(c) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.c.weekNumber - a.c.weekNumber ||
        a.c.hanzi.localeCompare(b.c.hanzi),
    )
    .slice(0, count)
    .map((x) => x.c);
}
