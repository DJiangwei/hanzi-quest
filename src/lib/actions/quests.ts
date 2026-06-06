'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { dailyQuests, dailyQuestChests } from '@/db/schema';
import { requireChild } from '@/lib/auth/guards';
import { awardCoins } from '@/lib/db/coins';
import { awardXp } from '@/lib/db/xp';
import { todayUtcIso } from '@/lib/db/streaks';
import { generateDailyQuests, getTodayQuests, type DailyQuestWithDef } from '@/lib/db/quests';
import { type QuestContext } from '@/lib/quests/definitions';

export type ClaimChestResult =
  | { ok: false; reason: 'not_ready' }
  | { ok: true; coins: number; alreadyClaimed?: boolean };

export async function claimDailyChest(childId: string): Promise<ClaimChestResult> {
  await requireChild(childId);

  const today = todayUtcIso();

  // Check how many quests are completed today
  const todayRows = await db
    .select()
    .from(dailyQuests)
    .where(and(eq(dailyQuests.childId, childId), eq(dailyQuests.date, today)));

  const completedCount = todayRows.filter((r) => r.completed).length;
  if (completedCount < 3) {
    return { ok: false, reason: 'not_ready' };
  }

  // Compute random coins: 50–100
  const coins = 50 + Math.floor(Math.random() * 51);

  // Attempt to insert the chest row (PK = childId + date)
  const inserted = await db
    .insert(dailyQuestChests)
    .values({ childId, date: today, coins })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    // Already claimed — fetch the existing row
    const [existing] = await db
      .select()
      .from(dailyQuestChests)
      .where(and(eq(dailyQuestChests.childId, childId), eq(dailyQuestChests.date, today)));
    return { ok: true, coins: existing?.coins ?? coins, alreadyClaimed: true };
  }

  const awardedCoins = inserted[0]!.coins;

  // Fresh claim — award coins + XP
  await awardCoins({ childId, delta: awardedCoins, reason: 'daily_chest', refType: 'utc_date', refId: today });
  await awardXp(childId, 30, 'daily_chest');
  revalidatePath(`/play/${childId}`);

  return { ok: true, coins: awardedCoins };
}

export async function generateAndGetTodayQuestsAction(
  childId: string,
  ctx: QuestContext,
): Promise<DailyQuestWithDef[]> {
  await requireChild(childId);
  await generateDailyQuests(childId, ctx);
  return getTodayQuests(childId);
}
