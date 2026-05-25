import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { streaks } from '@/db/schema';
import { consumePowerupAtomic } from './powerups';

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
  freezeTokens: number;
}

export interface StreakTick {
  currentStreak: number;
  longestStreak: number;
  /** True iff currentStreak just incremented (today != lastPlayedDate). */
  ticked: boolean;
  /** True iff the streak just reset to 1 (gap > 1 day, no freeze). */
  reset: boolean;
  /** True iff a streak_freeze powerup was consumed to preserve the streak. */
  freezeBurned: boolean;
}

/**
 * One UTC day in milliseconds.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the difference in calendar days between two UTC ISO date strings
 * (e.g. "2026-05-19"). Used to detect "today is the day after yesterday".
 */
function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export async function getStreakState(childId: string): Promise<StreakState> {
  const [row] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.childId, childId))
    .limit(1);
  if (row) {
    return {
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastPlayedDate: row.lastPlayedDate,
      freezeTokens: row.freezeTokens,
    };
  }
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedDate: null,
    freezeTokens: 0,
  };
}

/**
 * Updates the streaks table for `childId` on `todayIsoDate` (a UTC ISO date
 * like "2026-05-19"). Logic:
 *   - If today === lastPlayedDate: no change, no tick.
 *   - If today === lastPlayedDate + 1 day: currentStreak += 1.
 *   - Otherwise (first time, or gap > 1 day): currentStreak = 1, reset = true.
 * Always updates lastPlayedDate to today and bumps longestStreak if needed.
 *
 * Returns the post-tick state plus flags describing what happened, so the
 * caller can decide whether to award a streak-milestone bonus.
 */
export async function tickStreak(
  childId: string,
  todayIsoDate: string,
): Promise<StreakTick> {
  const prior = await getStreakState(childId);

  if (prior.lastPlayedDate === todayIsoDate) {
    return {
      currentStreak: prior.currentStreak,
      longestStreak: prior.longestStreak,
      ticked: false,
      reset: false,
      freezeBurned: false,
    };
  }

  const gap = prior.lastPlayedDate
    ? daysBetween(prior.lastPlayedDate, todayIsoDate)
    : null;

  let newStreak: number;
  let reset = false;
  let freezeBurned = false;

  if (gap === 1) {
    newStreak = prior.currentStreak + 1;
  } else if (gap !== null && gap > 1 && prior.currentStreak > 0) {
    // Try to burn a freeze token to bridge the gap
    const burned = await consumePowerupAtomic(childId, 'streak_freeze');
    if (burned) {
      newStreak = prior.currentStreak + 1;
      freezeBurned = true;
    } else {
      newStreak = 1;
      reset = true;
    }
  } else {
    // First-ever play (gap === null) or no prior streak
    newStreak = 1;
    reset = prior.currentStreak > 0;
  }

  const newLongest = Math.max(prior.longestStreak, newStreak);

  await db
    .insert(streaks)
    .values({
      childId,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastPlayedDate: todayIsoDate,
      freezeTokens: prior.freezeTokens,
    })
    .onConflictDoUpdate({
      target: streaks.childId,
      set: {
        currentStreak: newStreak,
        longestStreak: sql`GREATEST(${streaks.longestStreak}, ${newStreak})`,
        lastPlayedDate: todayIsoDate,
      },
    });

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    ticked: true,
    reset,
    freezeBurned,
  };
}

/**
 * Returns the current UTC date as an ISO date string (YYYY-MM-DD). Centralised
 * so tests can mock a single source of truth.
 */
export function todayUtcIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
