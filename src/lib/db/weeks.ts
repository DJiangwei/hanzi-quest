import { and, asc, desc, eq, isNull, max, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  characters,
  childProfiles,
  weekCharacters,
  weeks,
  type weekStatus,
} from '@/db/schema';

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
