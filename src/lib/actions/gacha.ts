'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { weekProgress } from '@/db/schema';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug } from '@/lib/db/collections';
import { pull, pullInTx, type PullResult } from '@/lib/db/gacha';
import { AlreadyClaimedError } from '@/lib/errors/gacha-errors';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import { todayUtcIso } from '@/lib/db/streaks';
import { pullCardInTx, swapShardsInTx, grantGiftPackInTx, type CardGrantResult, type CardGrantSkipped, type GiftCard } from '@/lib/db/grants';
import { getActivityForRange } from '@/lib/db/activity';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';
import { countCheckInDays, WEEKLY_CHECKIN_THRESHOLD } from '@/lib/db/checkins';

// AlreadyClaimedError is NOT re-exported here — 'use server' files may only
// export async functions. Client components import it directly from
// '@/lib/errors/gacha-errors'.

const ZODIAC_PACK_SLUG = 'zodiac-v1';
// Per-pack paid pull cost is read from packRegistry at action time. The
// previous hard-coded 500 was zodiac-specific; flags is 300 etc.

interface PullActionArgs {
  childId: string;
}

export async function pullFreeFromBoss(
  weekId: string,
  args: PullActionArgs,
): Promise<PullResult> {
  const { child } = await requireChild(args.childId);
  const pack = await getPackBySlug(ZODIAC_PACK_SLUG);
  if (!pack) throw new Error(`Pack ${ZODIAC_PACK_SLUG} not seeded`);

  const result = await db.transaction(async (tx) => {
    const [progress] = await tx
      .select({
        bossCleared: weekProgress.bossCleared,
        freePullClaimed: weekProgress.freePullClaimed,
      })
      .from(weekProgress)
      .where(
        and(
          eq(weekProgress.childId, child.id),
          eq(weekProgress.weekId, weekId),
        ),
      );

    if (!progress?.bossCleared) {
      throw new Error('Boss not cleared yet — finish the gauntlet first');
    }
    if (progress.freePullClaimed) {
      throw new AlreadyClaimedError();
    }

    // Mark claimed BEFORE pulling — if pull throws, the whole tx rolls back.
    await tx
      .update(weekProgress)
      .set({ freePullClaimed: true })
      .where(
        and(
          eq(weekProgress.childId, child.id),
          eq(weekProgress.weekId, weekId),
        ),
      );

    return pullInTx(tx, child.id, pack.id, { isFree: true, costCoins: 0 });
  });

  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/collection`);
  return result;
}

/**
 * @deprecated PR #52 — coin gacha removed. Kept for one release as a rollback path.
 *   Drop in PR #53+.
 */
export async function pullPaid(
  packSlug: string,
  args: PullActionArgs,
): Promise<PullResult> {
  const { child } = await requireChild(args.childId);
  const pack = await getPackBySlug(packSlug);
  if (!pack) throw new Error(`Unknown pack: ${packSlug}`);

  const meta = getPackMeta(packSlug);
  if (!meta) throw new Error(`Pack ${packSlug} has no UI meta registered`);

  const result = await pull(child.id, pack.id, {
    isFree: false,
    costCoins: meta.paidPullCost,
  });

  const trophies = await checkAndGrantTrophies(child.id, {
    kind: 'pack-complete',
    packSlug,
  });

  revalidatePath(`/play/${child.id}/collection`);
  revalidatePath(`/play/${child.id}/collection/${packSlug}`);
  return { ...result, trophies };
}

export type CardGrantSource = 'boss_clear' | 'perfect_week' | 'story_chapter';

export async function pullCardForChild(
  childId: string,
  source: CardGrantSource,
  refId: string,
): Promise<CardGrantResult | CardGrantSkipped> {
  const dayUtc = todayUtcIso();
  const result = await db.transaction((tx) =>
    pullCardInTx(tx, childId, source, refId, dayUtc, Math.random),
  );
  if (result.granted) {
    revalidatePath(`/play/${childId}/collection/${result.packSlug}`);
  }
  return result;
}

export async function swapShardsForItem(
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; shardsRemaining: number }
  | { ok: false; reason: 'insufficient_shards' | 'already_owned' | 'item_not_found' }
> {
  const { child } = await requireChild(childId);
  const result = await db.transaction((tx) => swapShardsInTx(tx, child.id, itemId));
  if (result.ok) {
    revalidatePath(`/play/${child.id}/collection`);
  }
  return result;
}

/**
 * Trust-caller (NO requireChild) — invoked from finishAttemptAction which is
 * already auth-gated. Grants the weekly check-in gift pack iff the child has
 * >= WEEKLY_CHECKIN_THRESHOLD distinct check-in days this UTC week and hasn't
 * claimed yet this week. Bypasses the daily cap. Returns the gift cards or null.
 */
export async function claimWeeklyGiftIfDue(
  childId: string,
): Promise<{ cards: GiftCard[] } | null> {
  const today = todayUtcIso();
  const monday = mondayOfIsoWeek(today);
  const sunday = addDaysUtc(monday, 6);
  const activity = await getActivityForRange(childId, monday, sunday);
  if (countCheckInDays(activity) < WEEKLY_CHECKIN_THRESHOLD) return null;

  const result = await db.transaction((tx) => grantGiftPackInTx(tx, childId, monday, Math.random));
  if (!result.granted) return null;

  revalidatePath(`/play/${childId}`);
  for (const c of result.cards) {
    revalidatePath(`/play/${childId}/collection/${c.packSlug}`);
  }
  return { cards: result.cards };
}

function addDaysUtc(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
