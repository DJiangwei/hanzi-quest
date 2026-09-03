'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { pullCardForChild } from '@/lib/play/card-grants';
import { awardCoins } from '@/lib/db/coins';
import { awardXp } from '@/lib/db/xp';
import { logAnswerEventsSafe } from '@/lib/db/answer-events';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import { todayUtcIso } from '@/lib/db/streaks';
import { MAX_EVENTS_PER_CALL } from '@/lib/play/answer-events';
import { REVIEW_REWARD_COINS, REVIEW_REWARD_XP } from '@/lib/review/selection';
import type { RevealCard } from '@/lib/play/reveal-card';

export type ReviewCardMessage = 'review_done_today' | 'daily_cap_reached' | null;

const FinishReviewSchema = z.object({
  childId: z.string().min(1),
  score: z.number().min(0).max(100),
  /** Per-answer telemetry — validated element-wise inside logAnswerEventsSafe. */
  events: z.array(z.unknown()).max(MAX_EVENTS_PER_CALL).optional(),
});

/**
 * Finish a 温故 session.
 *
 * The WHOLE reward fires only on `pullCardForChild`'s `granted` branch, so a
 * replay the same day grants nothing — the card-grant log row is the single
 * idempotency source, exactly as in finishStudyLessonAction and
 * finishHomeworkAction (`awardCoins` itself is not idempotent).
 *
 * **Completion pays, not score.** `score` is accepted on the input schema
 * (mirroring `finishStudyLessonAction`'s shape) but this action never logs
 * it, returns it, or reads it for any reward branch — the done screen's
 * tally is the runner's own `correct` count, not this field. A review that
 * punished wrong answers would be a test, and this product deliberately
 * does not test her — the same reasoning behind `boss_courage` paying out
 * on a FAILED boss.
 */
export async function finishReviewAction(
  input: z.input<typeof FinishReviewSchema>,
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  cardMessage: ReviewCardMessage;
  coinsAwarded: number;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishReviewSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const dayUtc = todayUtcIso();

  // `source` and `childId` are set HERE, from the validated context — never
  // from the client, which could otherwise attribute events to any surface.
  // Positional signature: (childId, weekId, source, events). weekId is null —
  // a 温故 session spans weeks by definition and belongs to none of them.
  await logAnswerEventsSafe(child.id, null, 'daily_review', parsed.events ?? []);

  let card: RevealCard | null = null;
  let cardMessage: ReviewCardMessage = null;
  let coinsAwarded = 0;
  let xp = { gained: 0, level: 1, leveledUp: false };

  // Guarded: a reward failure must never reject the action. The runner awaits
  // it inside a transition with no catch.
  try {
    const res = await pullCardForChild(child.id, 'daily_review', dayUtc);
    if (res.granted) {
      await awardCoins({
        childId: child.id,
        delta: REVIEW_REWARD_COINS,
        reason: 'daily_review',
        refType: 'day',
        refId: dayUtc,
      });
      coinsAwarded = REVIEW_REWARD_COINS;

      const xpRes = await awardXp(child.id, REVIEW_REWARD_XP, 'daily_review', dayUtc);
      xp = { gained: REVIEW_REWARD_XP, level: xpRes.level, leveledUp: xpRes.leveledUp };

      void tickQuestProgressSafe(child.id, 'earn_card', 1);
      card = {
        id: res.itemId,
        slug: res.slug,
        packSlug: res.packSlug,
        nameZh: res.nameZh,
        nameEn: res.nameEn,
        loreZh: res.loreZh,
        loreEn: res.loreEn,
        isDupe: res.isDupe,
        shardsAfter: res.shardsAfter,
      };
    } else {
      cardMessage =
        res.reason === 'daily_cap_reached' ? 'daily_cap_reached' : 'review_done_today';
    }
  } catch (err) {
    console.error('[finishReviewAction] reward failed:', err);
  }

  revalidatePath(`/play/${child.id}`);
  return {
    ok: true,
    cardGrants: card ? [card] : [],
    cardMessage,
    coinsAwarded,
    xp,
  };
}
