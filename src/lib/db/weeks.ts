import { and, asc, desc, eq, inArray, isNull, max, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  characters,
  childProfiles,
  weekCharacters,
  weekLevels,
  weekProgress,
  weeks,
  type weekStatus,
} from '@/db/schema';
import { BOSS_LEVEL_KEY } from '@/lib/scenes/configs';

export type WeekRow = typeof weeks.$inferSelect;
export type WeekStatus = (typeof weekStatus.enumValues)[number];

export interface CreateWeekInput {
  parentUserId: string;
  childId: string;
  curriculumPackId: string;
  label: string;
  notes?: string | null;
  status?: WeekStatus;
}

export async function createWeek(input: CreateWeekInput): Promise<WeekRow> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${weeks.weekNumber}), 0) + 1` })
    .from(weeks)
    .where(eq(weeks.childId, input.childId));

  const [row] = await db
    .insert(weeks)
    .values({
      parentUserId: input.parentUserId,
      childId: input.childId,
      curriculumPackId: input.curriculumPackId,
      weekNumber: next,
      label: input.label,
      notes: input.notes ?? null,
      status: input.status ?? 'ai_generating',
    })
    .returning();
  return row;
}

export async function getWeekOwnedBy(
  weekId: string,
  parentUserId: string,
): Promise<WeekRow | undefined> {
  const [row] = await db
    .select()
    .from(weeks)
    .where(and(eq(weeks.id, weekId), eq(weeks.parentUserId, parentUserId)))
    .limit(1);
  return row;
}

export async function listWeeksByChild(
  childId: string,
): Promise<WeekRow[]> {
  return db
    .select()
    .from(weeks)
    .where(eq(weeks.childId, childId))
    .orderBy(desc(weeks.weekNumber));
}

export async function setWeekStatus(
  weekId: string,
  status: WeekStatus,
): Promise<void> {
  await db
    .update(weeks)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(weeks.id, weekId));
}

export async function listCharactersForWeek(weekId: string) {
  return db
    .select({
      character: characters,
      position: weekCharacters.position,
    })
    .from(weekCharacters)
    .innerJoin(characters, eq(characters.id, weekCharacters.characterId))
    .where(eq(weekCharacters.weekId, weekId))
    .orderBy(asc(weekCharacters.position));
}

/**
 * Returns a single week if the given child is allowed to play it: either
 * a per-family week owned by the child, or a shared (child_id IS NULL)
 * pack week from the curriculum_pack the child is enrolled in. Status must
 * be 'published'. Returns undefined otherwise — callers should `notFound()`.
 *
 * This is the per-week version of listChildPlayableWeeks and MUST stay in
 * sync with it. The level page used to call getWeekOwnedBy(weekId, parentId)
 * which broke for shared pack weeks (parent_user_id IS NULL) — that's the
 * bug this function fixes.
 */
export async function getPlayableWeekForChild(
  childId: string,
  weekId: string,
): Promise<WeekRow | undefined> {
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);

  const packId = child?.packId ?? null;

  const condition = packId
    ? and(
        eq(weeks.id, weekId),
        eq(weeks.status, 'published'),
        or(
          eq(weeks.childId, childId),
          and(isNull(weeks.childId), eq(weeks.curriculumPackId, packId)),
        ),
      )
    : and(
        eq(weeks.id, weekId),
        eq(weeks.status, 'published'),
        eq(weeks.childId, childId),
      );

  const [row] = await db.select().from(weeks).where(condition).limit(1);
  return row;
}

/**
 * Returns weeks the given child can play right now: their own published
 * per-family weeks, plus any shared (child_id IS NULL) published weeks
 * from the curriculum_pack the child is currently enrolled in. Shared pack
 * weeks come first (week_number asc), then per-family weeks (most recent
 * first).
 */
export async function listChildPlayableWeeks(
  childId: string,
): Promise<WeekRow[]> {
  // Resolve which pack this child is on (if any).
  const [child] = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);

  const packId = child?.packId ?? null;

  const condition = packId
    ? or(
        and(
          eq(weeks.childId, childId),
          eq(weeks.status, 'published'),
        ),
        and(
          isNull(weeks.childId),
          eq(weeks.curriculumPackId, packId),
          eq(weeks.status, 'published'),
        ),
      )
    : and(eq(weeks.childId, childId), eq(weeks.status, 'published'));

  const rows = await db
    .select()
    .from(weeks)
    .where(condition)
    .orderBy(
      // Shared (childId IS NULL) first, then by week number ascending.
      sql`${weeks.childId} IS NOT NULL`,
      asc(weeks.weekNumber),
    );

  return rows;
}

void max;

/**
 * Which of the given weeks actually compiled a BOSS level.
 *
 * Not every published week has one: `compile-week.ts` only emits the boss when
 * the week has >= BOSS_MIN_CHARS characters, so a short week (Map 1's weeks 9
 * and 10 have 8 chars each) is bossless by design. Reading the compiled row is
 * the only honest answer — re-deriving it from the character count would drift
 * the moment the threshold or the week's content changes.
 */
export async function listBossWeekIds(
  weekIds: string[],
): Promise<Set<string>> {
  if (weekIds.length === 0) return new Set();
  const rows = await db
    .select({ weekId: weekLevels.weekId })
    .from(weekLevels)
    .where(
      and(
        inArray(weekLevels.weekId, weekIds),
        eq(weekLevels.levelKey, BOSS_LEVEL_KEY),
      ),
    );
  return new Set(rows.map((r) => r.weekId));
}

/**
 * Frontier (T1 双倍宝藏): the lowest week_number among the given weeks whose
 * boss the child has NOT cleared. Pure — tested directly.
 *
 * A candidate with `hasBoss: false` is skipped entirely: it has no boss to
 * clear, so it can never be "beaten" and would pin the frontier there forever —
 * which under T3 gating (below) would permanently lock every week after it.
 * `hasBoss` omitted means "assume it has one" so pre-T3 callers keep working.
 */
export function frontierWeekNumber(
  candidates: { id: string; weekNumber: number; hasBoss?: boolean }[],
  bossClearedWeekIds: ReadonlySet<string>,
): number | null {
  const open = candidates.filter(
    (w) => w.hasBoss !== false && !bossClearedWeekIds.has(w.id),
  );
  if (open.length === 0) return null;
  return Math.min(...open.map((w) => w.weekNumber));
}

/**
 * Linear island gating (T3): a week is playable up to and including the
 * FRONTIER. Everything past it stays 🔒 until its predecessor's boss falls.
 * `frontier === null` means every boss is beaten, so nothing is locked.
 *
 * `bossCleared` is an escape hatch that matters for real save data: a week the
 * child has ALREADY beaten stays open even if it sits past the frontier (she
 * beat a later island before the gate existed). Gating is there to push
 * progress forward, never to confiscate an island she already earned — and a
 * cleared week holds no new content to skip ahead to anyway.
 *
 * Pure — tested directly.
 */
export function isWeekUnlockedFrom(
  weekNumber: number,
  frontier: number | null,
  bossCleared = false,
): boolean {
  return bossCleared || frontier === null || weekNumber <= frontier;
}

export interface WeekGateState {
  /** The 双倍宝藏 frontier — lowest week whose boss is unbeaten (T1). */
  isFrontier: boolean;
  /** Whether the child may enter this week at all (T3 linear gating). */
  isUnlocked: boolean;
  /** Keys earned = bosses cleared in this week's pack (T3 derived key track). */
  keysEarned: number;
  /** Total keys available = published BOSSED weeks in this week's pack. */
  keysTotal: number;
}

/**
 * One query pass answering every gate question about `weekId`, scoped to the
 * same visibility set as getPlayableWeekForChild (the target week's pack, or
 * the per-family group). Server-authoritative — never trust a client claim of
 * "this is the frontier" or "this island is open".
 *
 * Returns a fully-locked state for a week the child can't see at all, so a
 * caller that forgets to check `getPlayableWeekForChild` still fails closed.
 */
export async function getWeekGateState(
  childId: string,
  weekId: string,
): Promise<WeekGateState> {
  const locked: WeekGateState = {
    isFrontier: false,
    isUnlocked: false,
    keysEarned: 0,
    keysTotal: 0,
  };

  const week = await getPlayableWeekForChild(childId, weekId);
  if (!week) return locked;

  const siblingCondition = week.curriculumPackId
    ? and(
        eq(weeks.status, 'published'),
        eq(weeks.curriculumPackId, week.curriculumPackId),
        or(eq(weeks.childId, childId), isNull(weeks.childId)),
      )
    : and(eq(weeks.status, 'published'), eq(weeks.childId, childId));

  const [siblings, cleared] = await Promise.all([
    db.select({ id: weeks.id, weekNumber: weeks.weekNumber }).from(weeks).where(siblingCondition),
    db
      .select({ weekId: weekProgress.weekId })
      .from(weekProgress)
      .where(and(eq(weekProgress.childId, childId), eq(weekProgress.bossCleared, true))),
  ]);

  const clearedSet = new Set(cleared.map((c) => c.weekId));
  // A bossless week can neither block the frontier nor mint a key.
  const bossWeekIds = await listBossWeekIds(siblings.map((w) => w.id));
  const bossable = siblings.filter((w) => bossWeekIds.has(w.id));
  const frontier = frontierWeekNumber(
    siblings.map((w) => ({ ...w, hasBoss: bossWeekIds.has(w.id) })),
    clearedSet,
  );

  return {
    isFrontier: frontier !== null && frontier === week.weekNumber,
    isUnlocked: isWeekUnlockedFrom(week.weekNumber, frontier, clearedSet.has(week.id)),
    keysEarned: bossable.filter((w) => clearedSet.has(w.id)).length,
    keysTotal: bossable.length,
  };
}

/**
 * True iff `weekId` is the child's FRONTIER week: the lowest-numbered
 * published week (same visibility set as getPlayableWeekForChild, scoped to
 * the target week's pack / per-family group) whose boss is not yet cleared.
 * Drives the double-treasure bonus.
 */
export async function isFrontierWeek(childId: string, weekId: string): Promise<boolean> {
  return (await getWeekGateState(childId, weekId)).isFrontier;
}
