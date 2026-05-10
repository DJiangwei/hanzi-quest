import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles } from '@/db/schema';

export type ChildProfileRow = typeof childProfiles.$inferSelect;

export interface CreateChildInput {
  parentUserId: string;
  displayName: string;
  birthYear?: number | null;
  currentCurriculumPackId?: string | null;
  avatarConfig?: Record<string, unknown>;
}

export async function createChildProfile(
  input: CreateChildInput,
): Promise<ChildProfileRow> {
  const [row] = await db
    .insert(childProfiles)
    .values({
      parentUserId: input.parentUserId,
      displayName: input.displayName,
      birthYear: input.birthYear ?? null,
      currentCurriculumPackId: input.currentCurriculumPackId ?? null,
      avatarConfig: input.avatarConfig ?? {},
    })
    .returning();
  return row;
}

export async function listChildrenByParent(
  parentUserId: string,
): Promise<ChildProfileRow[]> {
  return db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.parentUserId, parentUserId))
    .orderBy(asc(childProfiles.createdAt));
}

export async function getChildOwnedBy(
  childId: string,
  parentUserId: string,
): Promise<ChildProfileRow | undefined> {
  const [row] = await db
    .select()
    .from(childProfiles)
    .where(
      and(
        eq(childProfiles.id, childId),
        eq(childProfiles.parentUserId, parentUserId),
      ),
    )
    .limit(1);
  return row;
}
