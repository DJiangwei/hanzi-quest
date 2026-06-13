// NEVER import this file from client code. It pulls in postgres.
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { homeworkItems } from '@/db/schema';
import type { HomeworkType } from '@/lib/homework/schemas';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface HomeworkItemRow {
  id: string;
  childId: string;
  weekId: string;
  position: number;
  type: HomeworkType;
  config: unknown;
}

/** Homework for ONE child's week (per-child since 2026-06-13). */
export async function listHomeworkItems(
  childId: string,
  weekId: string,
): Promise<HomeworkItemRow[]> {
  const rows = await db
    .select({
      id: homeworkItems.id,
      childId: homeworkItems.childId,
      weekId: homeworkItems.weekId,
      position: homeworkItems.position,
      type: homeworkItems.type,
      config: homeworkItems.config,
    })
    .from(homeworkItems)
    .where(
      and(eq(homeworkItems.childId, childId), eq(homeworkItems.weekId, weekId)),
    )
    .orderBy(asc(homeworkItems.position));
  return rows as HomeworkItemRow[];
}

export async function weekHasHomework(
  childId: string,
  weekId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: homeworkItems.id })
    .from(homeworkItems)
    .where(
      and(eq(homeworkItems.childId, childId), eq(homeworkItems.weekId, weekId)),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createHomeworkItem(input: {
  childId: string;
  weekId: string;
  type: HomeworkType;
  config: unknown;
}): Promise<string> {
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${homeworkItems.position}), -1)`.as('max') })
    .from(homeworkItems)
    .where(
      and(
        eq(homeworkItems.childId, input.childId),
        eq(homeworkItems.weekId, input.weekId),
      ),
    );
  const position = Number(maxRow?.max ?? -1) + 1;
  const [row] = await db
    .insert(homeworkItems)
    .values({
      childId: input.childId,
      weekId: input.weekId,
      type: input.type,
      config: input.config,
      position,
    })
    .returning({ id: homeworkItems.id });
  return row!.id;
}

export async function updateHomeworkItem(id: string, config: unknown): Promise<void> {
  await db
    .update(homeworkItems)
    .set({ config, updatedAt: new Date() })
    .where(eq(homeworkItems.id, id));
}

export async function deleteHomeworkItem(id: string): Promise<void> {
  await db.delete(homeworkItems).where(eq(homeworkItems.id, id));
}

export async function reorderHomeworkItems(
  childId: string,
  weekId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(homeworkItems)
        .set({ position: i })
        .where(
          and(
            eq(homeworkItems.id, orderedIds[i]!),
            eq(homeworkItems.childId, childId),
            eq(homeworkItems.weekId, weekId),
          ),
        );
    }
  });
}
