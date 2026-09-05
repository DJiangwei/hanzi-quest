// Which curriculum packs (maps) a child's learning history spans.
//
// SERVER-ONLY, and deliberately NOT under src/lib/actions/: every exported
// async function in a 'use server' file is a public RPC endpoint, and this one
// takes a raw childId.
//
// **Why this exists.** 温故, 航海日志 and 通缉令 each scoped their character pool
// to `child_profiles.current_curriculum_pack_id`. That is the right scope for
// the voyage board — it draws one map — and the wrong scope for every feature
// that is about what the child has LEARNED, because the column changes the
// moment she finishes a map and sails to the next one.
//
// Measured in production on 2026-09-05, the day both children moved to 里海:
// 航海日志 dropped from 96 characters to 8, and 温故 went dark entirely (it
// needs cleared weeks in the current pack, and she had cleared none there yet).
// Finishing a map erased the record of everything learned in it, at exactly the
// moment retention matters most.
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles } from '@/db/schema/auth';
import { weeks } from '@/db/schema/content';
import { weekProgress } from '@/db/schema/game';

/**
 * Every pack the child has ENTERED: the one she is on now, plus any pack
 * holding a week she has progress in.
 *
 * Progress rows, not `final_boss_clears`, define "entered" — a child who
 * played half a map and switched away has still learned those characters, and
 * a map she has never opened contributes nothing. Returns `[]` only for a
 * child with no current pack and no progress anywhere.
 */
export async function listEnteredPackIds(childId: string): Promise<string[]> {
  const [current] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);

  // `select`, not `selectDistinct`: the Set below already dedupes, and every
  // suite that mocks `@/db` would otherwise have to grow a `selectDistinct`
  // method just to import a module that calls this. A shared helper has to be
  // safe to drop into any file — the `logError` lesson (PR #172), where one new
  // call site broke 14 unrelated suites at import time.
  const played = await db
    .select({ packId: weeks.curriculumPackId })
    .from(weekProgress)
    .innerJoin(weeks, eq(weeks.id, weekProgress.weekId))
    .where(eq(weekProgress.childId, childId));

  const ids = new Set<string>();
  if (current?.packId) ids.add(current.packId);
  for (const row of played) if (row.packId) ids.add(row.packId);
  return [...ids];
}

/**
 * SQL for "this week belongs to a pack the child has entered, or is a week
 * authored for her personally".
 *
 * `packIds` empty means the child has no pack and no progress; the condition
 * then narrows to her own authored weeks rather than matching everything —
 * an `inArray` with an empty list would be `false`, but spelling it out keeps
 * the intent visible at the call sites.
 */
export function enteredPackCondition(childId: string, packIds: string[]) {
  if (packIds.length === 0) return eq(weeks.childId, childId);
  return sql`(${weeks.childId} = ${childId} OR (${weeks.childId} IS NULL AND ${inArray(
    weeks.curriculumPackId,
    packIds,
  )}))`;
}
