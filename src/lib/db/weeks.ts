import { and, asc, desc, eq, max, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  characters,
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
      status: 'ai_generating',
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

void max;
