import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { dailyQuests, dailyQuestChests } from '@/db/schema';
import { todayUtcIso } from '@/lib/db/streaks';
import { QUEST_DEFS, getQuestDef, type QuestContext, type QuestDef } from '@/lib/quests/definitions';
import { awardXp } from '@/lib/db/xp';

// ─── date helpers ────────────────────────────────────────────────────────────

function todayUtc(): string {
  return todayUtcIso();
}

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Fisher-Yates shuffle (in-place, returns array)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ─── types ───────────────────────────────────────────────────────────────────

export type DailyQuestRow = typeof dailyQuests.$inferSelect;

export interface DailyQuestWithDef extends DailyQuestRow {
  def: QuestDef | undefined;
}

// ─── generateDailyQuests ─────────────────────────────────────────────────────

/**
 * Idempotent: if today's quests already exist, return them.
 * Otherwise pick 3 feasible quests (excluding yesterday's keys) and insert.
 */
export async function generateDailyQuests(
  childId: string,
  ctx: QuestContext,
): Promise<DailyQuestRow[]> {
  const today = todayUtc();

  // Check if today's quests already exist
  const existing = await db
    .select()
    .from(dailyQuests)
    .where(and(eq(dailyQuests.childId, childId), eq(dailyQuests.date, today)));

  if (existing.length > 0) {
    return existing;
  }

  // Fetch yesterday's quest keys to exclude
  const yesterday = yesterdayUtc();
  const yesterdayRows = await db
    .select()
    .from(dailyQuests)
    .where(and(eq(dailyQuests.childId, childId), eq(dailyQuests.date, yesterday)));

  const yesterdayKeys = new Set(yesterdayRows.map((r) => r.questId));

  // Pick 3 feasible quests, excluding yesterday's
  const candidates = QUEST_DEFS.filter(
    (q) => q.feasible(ctx) && !yesterdayKeys.has(q.key),
  );
  const picked = shuffle([...candidates]).slice(0, 3);

  if (picked.length === 0) {
    return [];
  }

  const values = picked.map((q) => ({
    childId,
    date: today,
    questId: q.key,
    progress: 0,
    target: q.target,
    completed: false,
  }));

  const inserted = await db
    .insert(dailyQuests)
    .values(values)
    .onConflictDoNothing()
    .returning();

  return inserted;
}

// ─── getTodayQuests ───────────────────────────────────────────────────────────

export async function getTodayQuests(childId: string): Promise<DailyQuestWithDef[]> {
  const today = todayUtc();
  const rows = await db
    .select()
    .from(dailyQuests)
    .where(and(eq(dailyQuests.childId, childId), eq(dailyQuests.date, today)));

  return rows.map((r) => ({ ...r, def: getQuestDef(r.questId) }));
}

// ─── tickQuestProgress ────────────────────────────────────────────────────────

export interface TickResult {
  ticked: boolean;
  completed?: boolean;
  def?: QuestDef;
}

export async function tickQuestProgress(
  childId: string,
  questKey: string,
  amount: number,
): Promise<TickResult> {
  const today = todayUtc();

  const [row] = await db
    .select()
    .from(dailyQuests)
    .where(
      and(
        eq(dailyQuests.childId, childId),
        eq(dailyQuests.date, today),
        eq(dailyQuests.questId, questKey),
      ),
    );

  if (!row || row.completed) {
    return { ticked: false };
  }

  const newProgress = Math.min(row.progress + amount, row.target);
  const done = newProgress >= row.target;

  await db
    .update(dailyQuests)
    .set({ progress: newProgress, ...(done ? { completed: true } : {}) })
    .where(eq(dailyQuests.id, row.id));

  const def = getQuestDef(questKey);

  if (done && def) {
    await awardXp(childId, def.xp, 'daily_quest', row.id);
  }

  return { ticked: true, completed: done, def };
}

// ─── getDailyChestClaimed ─────────────────────────────────────────────────────

/**
 * Returns whether today's daily quest chest has been claimed for the child.
 */
export async function getDailyChestClaimed(childId: string): Promise<boolean> {
  const today = todayUtc();
  const [row] = await db
    .select()
    .from(dailyQuestChests)
    .where(and(eq(dailyQuestChests.childId, childId), eq(dailyQuestChests.date, today)));
  return row !== undefined;
}

/**
 * Fire-and-forget safe variant — swallows errors so callers can void it.
 */
export async function tickQuestProgressSafe(
  childId: string,
  questKey: string,
  amount: number,
): Promise<void> {
  try {
    await tickQuestProgress(childId, questKey, amount);
  } catch (err) {
    console.error('[quests] tickQuestProgressSafe error:', err);
  }
}
