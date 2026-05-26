import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { coinTransactions } from '@/db/schema';

export interface ActivityDay {
  dateIso: string;
  played: boolean;
  dailyLoginBonus: boolean;
  freezeBurned: boolean;
  coinsEarned: number;
}

interface DayTx {
  date: string;
  reason: string;
  delta: number;
}

/**
 * Iterates dateIso from startIso to endIso (inclusive), bucketing the input
 * transactions into per-day rollups.
 */
export function bucketByDate(
  txs: readonly DayTx[],
  startIso: string,
  endIso: string,
): ActivityDay[] {
  const byDate = new Map<string, ActivityDay>();
  for (const d of iterateDates(startIso, endIso)) {
    byDate.set(d, {
      dateIso: d,
      played: false,
      dailyLoginBonus: false,
      freezeBurned: false,
      coinsEarned: 0,
    });
  }
  for (const tx of txs) {
    const day = byDate.get(tx.date);
    if (!day) continue;
    if (tx.reason === 'daily_login') day.dailyLoginBonus = true;
    else if (tx.reason === 'streak_freeze') day.freezeBurned = true;
    else if (tx.delta > 0) day.played = true;
    if (tx.delta > 0) day.coinsEarned += tx.delta;
  }
  return Array.from(byDate.values());
}

function iterateDates(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export async function getActivityForRange(
  childId: string,
  startIso: string,
  endIso: string,
): Promise<ActivityDay[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${coinTransactions.createdAt} at time zone 'utc', 'YYYY-MM-DD')`,
      reason: coinTransactions.reason,
      delta: coinTransactions.delta,
    })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.childId, childId),
        gte(
          sql`(${coinTransactions.createdAt} at time zone 'utc')::date`,
          sql`${startIso}::date`,
        ),
        lte(
          sql`(${coinTransactions.createdAt} at time zone 'utc')::date`,
          sql`${endIso}::date`,
        ),
      ),
    )
    .orderBy(coinTransactions.createdAt);

  return bucketByDate(rows, startIso, endIso);
}
