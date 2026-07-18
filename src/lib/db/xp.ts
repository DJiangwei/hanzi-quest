import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childXp, xpEvents } from '@/db/schema';
import { levelForXp } from '@/lib/xp/levels';

export type XpSource =
  | 'scene_complete'
  | 'scene_perfect'
  | 'boss_clear'
  | 'daily_quest'
  | 'daily_chest'
  | 'streak_milestone'
  | 'homework'
  | 'study'
  | 'admin_grant'
  | 'boss_courage'
  | 'bounty_claim';

export interface AwardXpResult { totalXp: number; level: number; leveledUp: boolean; }

export async function awardXp(
  childId: string,
  amount: number,
  source: XpSource,
  refId?: string,
): Promise<AwardXpResult> {
  if (amount <= 0) {
    const [row] = await db.select().from(childXp).where(eq(childXp.childId, childId));
    const totalXp = row?.totalXp ?? 0;
    return { totalXp, level: levelForXp(totalXp), leveledUp: false };
  }
  await db.insert(xpEvents).values({ childId, amount, source, refId: refId ?? null });
  const [before] = await db.select({ level: childXp.level }).from(childXp).where(eq(childXp.childId, childId));
  const oldLevel = before?.level ?? 1;
  const [after] = await db
    .insert(childXp)
    .values({ childId, totalXp: amount, level: levelForXp(amount), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: childXp.childId,
      set: { totalXp: sql`${childXp.totalXp} + ${amount}`, updatedAt: new Date() },
    })
    .returning({ totalXp: childXp.totalXp });
  const totalXp = after?.totalXp ?? amount;
  const level = levelForXp(totalXp);
  if (level !== oldLevel) {
    await db.update(childXp).set({ level }).where(eq(childXp.childId, childId));
  }
  return { totalXp, level, leveledUp: level > oldLevel };
}

export async function getChildXp(childId: string): Promise<{ totalXp: number; level: number }> {
  const [row] = await db.select({ totalXp: childXp.totalXp, level: childXp.level }).from(childXp).where(eq(childXp.childId, childId));
  return { totalXp: row?.totalXp ?? 0, level: row?.level ?? 1 };
}
