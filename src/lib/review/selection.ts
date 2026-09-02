// A2 温故 — pure review-selection engine (client-safe, no db imports).
// Second consumer of the A1 answer_events telemetry, after T2 bounties.

/** Questions in one 温故 session. */
export const REVIEW_SESSION_SIZE = 6;

/** Weakness assigned to a character with no telemetry at all. */
export const NEUTRAL_WEAKNESS = 20;

/** Staleness assumed for a character never seen in the telemetry window. */
export const STALE_DEFAULT_DAYS = 14;

/** Staleness stops accumulating here. */
export const STALE_CAP = 30;

export const REVIEW_REWARD_COINS = 40;
export const REVIEW_REWARD_XP = 15;

export interface ReviewCandidate {
  characterId: string;
  hanzi: string;
  weekNumber: number;
  /** All-time answer_events rows targeting this char. */
  total: number;
  /** correct = false rows. */
  wrong: number;
  /** dont_know / not_sure self-ratings. */
  dontKnow: number;
  /** Days since the most recent event, or null when there is none. */
  daysSinceLastSeen: number | null;
}

/**
 * How much this character wants reviewing. Higher = sooner.
 *
 * **Why this is not `bountyScore`.** That scorer ranks a never-answered
 * character above every weak one (`total === 0 → 100 + weekNumber`) because
 * bounties exist to push the child into *unvisited later weeks* — the
 * avoidance behaviour T2 targets. Review targets the opposite population:
 * characters she has already cleared and is now forgetting. Reusing it would
 * fail twice — every character from a week cleared before answer_events
 * started (2026-07-03) has `total === 0` despite being well learned and would
 * score 100+, and recency, the core forgetting signal, is not modelled at all.
 */
export function reviewScore(c: ReviewCandidate): number {
  const weakness =
    c.total > 0
      ? Math.round((60 * (c.wrong + c.dontKnow)) / c.total)
      : NEUTRAL_WEAKNESS;
  const staleness = Math.min(c.daysSinceLastSeen ?? STALE_DEFAULT_DAYS, STALE_CAP);
  return weakness + staleness;
}

/**
 * Today's review targets: top `count` by score. Deterministic — ties break by
 * `weekNumber` desc then `hanzi`, mirroring `pickBounties`, so the same input
 * always yields the same session.
 */
export function pickReviewTargets(
  candidates: ReviewCandidate[],
  count: number = REVIEW_SESSION_SIZE,
): ReviewCandidate[] {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.characterId)) return false;
    seen.add(c.characterId);
    return true;
  });

  return unique
    .map((c) => ({ c, score: reviewScore(c) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.c.weekNumber - a.c.weekNumber ||
        a.c.hanzi.localeCompare(b.c.hanzi),
    )
    .slice(0, count)
    .map((x) => x.c);
}
