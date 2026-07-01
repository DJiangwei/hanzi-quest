// NEVER import this file from client code — it pulls in postgres.
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { finalBossClears } from '@/db/schema';
import { listChildPlayableWeeks } from '@/lib/db/weeks';
import { listProgressByChild } from '@/lib/db/play';

interface WeekLite {
  id: string;
  curriculumPackId: string;
}
interface ProgressLite {
  weekId: string;
  bossCleared: boolean;
}

/** Pure core: true iff the pack has ≥1 week and every one is bossCleared. */
export function isMapFullyClearedFrom(
  packId: string,
  weeks: WeekLite[],
  progress: ProgressLite[],
): boolean {
  const packWeeks = weeks.filter((w) => w.curriculumPackId === packId);
  if (packWeeks.length === 0) return false;
  const clearedSet = new Set(
    progress.filter((p) => p.bossCleared).map((p) => p.weekId),
  );
  return packWeeks.every((w) => clearedSet.has(w.id));
}

export async function isMapFullyCleared(
  childId: string,
  packId: string,
): Promise<boolean> {
  const [weeks, progress] = await Promise.all([
    listChildPlayableWeeks(childId),
    listProgressByChild(childId),
  ]);
  return isMapFullyClearedFrom(
    packId,
    weeks as WeekLite[],
    progress as ProgressLite[],
  );
}

/** Whether this child has beaten this map's final boss. */
export async function getFinalBossClear(
  childId: string,
  packId: string,
): Promise<boolean> {
  const rows = await db
    .select({ packId: finalBossClears.packId })
    .from(finalBossClears)
    .where(
      and(
        eq(finalBossClears.childId, childId),
        eq(finalBossClears.packId, packId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** All pack ids this child has beaten the final boss for (for gating). */
export async function listFinalBossClears(childId: string): Promise<string[]> {
  const rows = await db
    .select({ packId: finalBossClears.packId })
    .from(finalBossClears)
    .where(eq(finalBossClears.childId, childId));
  return rows.map((r) => r.packId);
}
