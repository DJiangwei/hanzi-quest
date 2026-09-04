// V1 — the single mastery substrate over A1 `answer_events`.
//
// PURE and client-safe: no `@/db`, no `@/lib/db/*`, no React, no randomness.
// Two readers depend on it — the 航海日志 Logbook (display) and
// `reviewScore` (温故's ranking) — so that the project has one notion of "how
// well does she know this character" instead of two that drift.
//
// Deliberately NOT a stored column. The corpus is 96 characters and hundreds
// of events; compute on read and cache only when measurably slow.

/** Observations required before a character earns any badge at all. */
export const MASTERY_MIN_EVIDENCE = 3;

/** Accuracy at or above which a rated character reads as 熟练. */
export const PROFICIENT_ACCURACY = 0.8;

export type MasteryState = 'unrated' | 'learning' | 'proficient';

export interface MasteryInput {
  /** Rows with a real right/wrong verdict (`correct IS NOT NULL`). */
  scored: number;
  /** Rows with `correct = false`. A subset of `scored`. */
  wrong: number;
  /** dont_know / not_sure self-ratings. NOT a subset of `scored`. */
  dontKnow: number;
}

export interface Mastery {
  state: MasteryState;
  /** (wrong + dontKnow) / evidence, or null when there is no evidence. */
  missRate: number | null;
  /** scored + dontKnow — every observation that COULD express a miss. */
  evidence: number;
}

/**
 * How well she knows this character, judged only on evidence that could have
 * gone either way.
 *
 * **Why `got_it` is excluded from the denominator.** In production every one
 * of the 164 flashcard self-ratings is `got_it` — not one `not_sure`, not one
 * `dont_know`, ever. A field whose every observation is identical carries no
 * information, and counting those rows would let five tapped-through cards
 * bury one genuinely failed answer. `dontKnow` stays in BOTH the numerator and
 * the denominator: a self-declared "I don't know this" is real evidence.
 *
 * **Why there is no decay.** This answers *what does she know*; `reviewScore`
 * answers *what should she practise* and models forgetting there. A badge that
 * vanished after a fortnight's gap would punish a child whose play is bursty
 * by nature.
 */
export function masteryForChar(input: MasteryInput): Mastery {
  const evidence = input.scored + input.dontKnow;
  if (evidence === 0) return { state: 'unrated', missRate: null, evidence: 0 };

  const missRate = (input.wrong + input.dontKnow) / evidence;
  if (evidence < MASTERY_MIN_EVIDENCE) return { state: 'unrated', missRate, evidence };

  const state: MasteryState =
    1 - missRate >= PROFICIENT_ACCURACY ? 'proficient' : 'learning';
  return { state, missRate, evidence };
}
