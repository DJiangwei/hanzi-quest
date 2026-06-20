import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import { grantContinentRewards } from '@/lib/db/continent-rewards';
import { todayUtcIso } from '@/lib/db/streaks';
import {
  pullCardInTx,
  grantGiftPackInTx,
  type CardGrantResult,
  type CardGrantSkipped,
  type GiftCard,
} from '@/lib/db/grants';
import { getActivityForRange } from '@/lib/db/activity';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';
import { countCheckInDays, WEEKLY_CHECKIN_THRESHOLD } from '@/lib/db/checkins';
import { tickQuestProgressSafe } from '@/lib/db/quests';

export type CardGrantSource =
  | 'boss_clear'
  | 'perfect_week'
  | 'story_chapter'
  | 'review'
  | 'practice'
  | 'homework'
  | 'study';

export async function pullCardForChild(
  childId: string,
  source: CardGrantSource,
  refId: string,
  packSlug?: string,
): Promise<CardGrantResult | CardGrantSkipped> {
  const dayUtc = todayUtcIso();
  const result = await db.transaction((tx) =>
    pullCardInTx(tx, childId, source, refId, dayUtc, Math.random, packSlug),
  );
  if (result.granted) {
    revalidatePath(`/play/${childId}/collection/${result.packSlug}`);
    void safePackCompleteTrophy(childId, result.packSlug);
    if (result.packSlug === 'flags-v1') void safeContinentTrophies(childId);
  }
  return result;
}

/** Guarded pack-complete trophy check. Never throws. */
export async function safePackCompleteTrophy(childId: string, packSlug: string): Promise<void> {
  try {
    await checkAndGrantTrophies(childId, { kind: 'pack-complete', packSlug });
  } catch (err) {
    console.error('[card-grants] pack-complete trophy check failed:', err);
  }
}

/** Guarded continent-complete reward grant (trophy + cosmetic). Never throws. */
async function safeContinentTrophies(childId: string): Promise<void> {
  try {
    await grantContinentRewards(childId);
  } catch (err) {
    console.error('[card-grants] continent-complete reward grant failed:', err);
  }
}

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

  if (result.cards.length > 0) {
    void tickQuestProgressSafe(childId, 'earn_card', result.cards.length);
  }

  revalidatePath(`/play/${childId}`);
  const giftSlugs = new Set(result.cards.map((c) => c.packSlug));
  for (const slug of giftSlugs) {
    revalidatePath(`/play/${childId}/collection/${slug}`);
    void safePackCompleteTrophy(childId, slug);
  }
  if (giftSlugs.has('flags-v1')) void safeContinentTrophies(childId);
  return { cards: result.cards };
}

function addDaysUtc(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
