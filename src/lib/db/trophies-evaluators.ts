import { and, countDistinct, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  childCollections,
  coinBalances,
  collectibleItems,
  playSessions,
  sceneAttempts,
  sceneTemplates,
  shopItems,
  shopPurchases,
  streaks,
  weekLevels,
} from '@/db/schema';

export async function countCompletedLevels(childId: string): Promise<number> {
  const rows = await db
    .select({ count: countDistinct(sceneAttempts.weekLevelId).as('count') })
    .from(sceneAttempts)
    .innerJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
    .where(and(eq(playSessions.childId, childId), sql`${sceneAttempts.score} >= 100`));
  return Number(rows[0]?.count ?? 0);
}

export async function countDistinctBossWeeks(childId: string): Promise<number> {
  // A "boss clear" is any sceneAttempt for a boss-template level with score >= 100.
  const rows = await db
    .select({ count: countDistinct(weekLevels.weekId).as('count') })
    .from(sceneAttempts)
    .innerJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
    .innerJoin(weekLevels, eq(weekLevels.id, sceneAttempts.weekLevelId))
    .innerJoin(sceneTemplates, eq(sceneTemplates.id, weekLevels.sceneTemplateId))
    .where(
      and(
        eq(playSessions.childId, childId),
        eq(sceneTemplates.type, 'boss'),
        sql`${sceneAttempts.score} >= 100`,
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

export { isPerfectWeekForChild } from '@/lib/db/play';

export async function getLifetimeEarned(childId: string): Promise<number> {
  const rows = await db
    .select({ lifetimeEarned: coinBalances.lifetimeEarned })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId))
    .limit(1);
  return rows[0]?.lifetimeEarned ?? 0;
}

export async function isPackComplete(childId: string, packId: string): Promise<boolean> {
  // owned count = total count → complete
  const totalRow = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packId));
  const ownedRow = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(childCollections)
    .innerJoin(collectibleItems, eq(collectibleItems.id, childCollections.itemId))
    .where(and(eq(childCollections.childId, childId), eq(collectibleItems.packId, packId)));
  const total = Number(totalRow[0]?.count ?? 0);
  const owned = Number(ownedRow[0]?.count ?? 0);
  return total > 0 && owned >= total;
}

export async function getLongestStreak(childId: string): Promise<number> {
  const rows = await db
    .select({ longestStreak: streaks.longestStreak })
    .from(streaks)
    .where(eq(streaks.childId, childId))
    .limit(1);
  return rows[0]?.longestStreak ?? 0;
}

export async function countOwnedDecorations(childId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(shopPurchases)
    .innerJoin(shopItems, eq(shopItems.id, shopPurchases.shopItemId))
    .where(and(eq(shopPurchases.childId, childId), eq(shopItems.kind, 'decor')));
  return Number(rows[0]?.count ?? 0);
}
