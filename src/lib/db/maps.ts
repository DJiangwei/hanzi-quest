import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { curriculumPacks, weeks, childProfiles } from '@/db/schema';
import { mapOrderIndex } from '@/lib/play/map-order';
import { listFinalBossClears } from '@/lib/db/final-boss';

export interface MapForChild {
  packId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  weekCount: number;
  clearedCount: number;
  isCurrent: boolean;
  gated: boolean;
  isLocked: boolean;
}

export interface RawMap {
  packId: string;
  slug: string;
  nameZh: string | null;
  nameEn: string | null;
  name: string;
  weekCount: number;
}

/** Pure gating core. A map (order>min) is `gated` until the IMMEDIATELY-previous
 *  map (by order) is in `clearedPackIds`. Map at the minimum order is never gated. */
export function computeMapGating(
  rows: RawMap[],
  clearedPackIds: Set<string>,
  currentPackId: string | null,
): MapForChild[] {
  const ordered = [...rows].sort(
    (a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug),
  );
  return ordered.map((r, i) => {
    const prev = ordered[i - 1];
    const gated = i > 0 && prev ? !clearedPackIds.has(prev.packId) : false;
    return {
      packId: r.packId,
      slug: r.slug,
      nameZh: r.nameZh ?? r.name,
      nameEn: r.nameEn ?? r.name,
      weekCount: r.weekCount,
      clearedCount: 0,
      isCurrent: r.packId === currentPackId,
      gated,
      isLocked: r.weekCount === 0 || gated,
    };
  });
}

export async function getCurrentPackId(childId: string): Promise<string | null> {
  const rows = await db
    .select({ packId: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  return rows[0]?.packId ?? null;
}

/** Slug for a curriculum pack id (the key for per-map lookup tables such as
 *  MAP_TO_VAULT_CARD / MAP_TO_CHAMPION_CARD). Null when the pack is gone. */
export async function getPackSlugById(packId: string): Promise<string | null> {
  const rows = await db
    .select({ slug: curriculumPacks.slug })
    .from(curriculumPacks)
    .where(eq(curriculumPacks.id, packId))
    .limit(1);
  return rows[0]?.slug ?? null;
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
    // The published filter belongs in the JOIN, not the WHERE. isLocked is
    // `weekCount === 0`, and counting drafts meant a map went UNLOCKED the
    // moment authoring created its first draft week — while
    // getPlayableWeekForChild only serves published weeks, so its islands led
    // nowhere. Putting the condition in a WHERE instead would narrow the LEFT
    // JOIN into an INNER one and drop zero-week packs out of the list entirely,
    // rather than showing them locked.
    .leftJoin(
      weeks,
      and(eq(weeks.curriculumPackId, curriculumPacks.id), eq(weeks.status, 'published')),
    )
    .where(eq(curriculumPacks.isPublic, true))
    .groupBy(curriculumPacks.id)
    .orderBy(curriculumPacks.createdAt);

  const clearedPackIds = new Set(await listFinalBossClears(childId));
  const rawMaps: RawMap[] = rows.map((r) => ({
    packId: r.packId,
    slug: r.slug,
    nameZh: r.nameZh,
    nameEn: r.nameEn,
    name: r.name,
    weekCount: Number(r.weekCount),
  }));
  return computeMapGating(rawMaps, clearedPackIds, currentPackId);
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
