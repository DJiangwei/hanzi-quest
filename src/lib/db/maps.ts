import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { curriculumPacks, weeks, childProfiles } from '@/db/schema';

export interface MapForChild {
  packId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  weekCount: number;
  clearedCount: number;
  isCurrent: boolean;
  isLocked: boolean;
}

export async function getCurrentPackId(childId: string): Promise<string | null> {
  const rows = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  return rows[0]?.packId ?? null;
}

export async function listMapsForChild(childId: string): Promise<MapForChild[]> {
  const currentPackId = await getCurrentPackId(childId);

  const rows = await db
    .select({
      packId: curriculumPacks.id,
      slug: curriculumPacks.slug,
      nameZh: curriculumPacks.nameZh,
      nameEn: curriculumPacks.nameEn,
      name: curriculumPacks.name,
      weekCount: sql<number>`coalesce(count(${weeks.id}), 0)::int`,
    })
    .from(curriculumPacks)
    .leftJoin(weeks, eq(weeks.curriculumPackId, curriculumPacks.id))
    .where(eq(curriculumPacks.isPublic, true))
    .groupBy(curriculumPacks.id)
    .orderBy(curriculumPacks.createdAt);

  return rows.map((r) => ({
    packId: r.packId,
    slug: r.slug,
    nameZh: r.nameZh ?? r.name,
    nameEn: r.nameEn ?? r.name,
    weekCount: Number(r.weekCount),
    clearedCount: 0, // TODO follow-up: count weeks with progress=100%
    isCurrent: r.packId === currentPackId,
    isLocked: Number(r.weekCount) === 0,
  }));
}

export async function setCurrentPackForChild(
  childId: string,
  packId: string,
): Promise<void> {
  await db
    .update(childProfiles)
    .set({ currentCurriculumPackId: packId })
    .where(eq(childProfiles.id, childId));
}
