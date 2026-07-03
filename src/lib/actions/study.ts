'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug, listChildCollection } from '@/lib/db/collections';
import { pullCardForChild } from '@/lib/play/card-grants';
import { awardXp } from '@/lib/db/xp';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import { todayUtcIso } from '@/lib/db/streaks';
import { STUDY_MIN_OWNED } from '@/lib/play/study';
import type { RevealCard } from '@/lib/play/reveal-card';
import { logAnswerEventsSafe } from '@/lib/db/answer-events';
import { MAX_EVENTS_PER_CALL } from '@/lib/play/answer-events';

const STUDY_PASS_SCORE = 60; // gentle bar for a 6yo (≈4/6)
const STUDY_XP = 15;

export type StudyCardMessage = 'study_done_today' | 'daily_cap_reached' | null;

const FinishStudySchema = z.object({
  childId: z.string().min(1),
  packSlug: z.string(),
  score: z.number().min(0).max(100),
  /** Per-answer telemetry batch — validated element-wise in logAnswerEventsSafe. */
  events: z.array(z.unknown()).max(MAX_EVENTS_PER_CALL).optional(),
});

/**
 * Finish a study lesson. Mirrors finishHomeworkAction's anti-farm pattern: the
 * WHOLE reward (XP + card) fires ONLY on the pullCardForChild `granted` branch,
 * so re-studying after the daily card is claimed grants nothing. Card is scoped
 * to this pack (`pullCardForChild(..., packSlug)`), once per (pack, UTC day) via
 * the refId, and still consumes the shared daily cap. Reward-only packs
 * (gacha_eligible=false) never grant.
 */
export async function finishStudyLessonAction(
  input: z.input<typeof FinishStudySchema>,
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  cardMessage: StudyCardMessage;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishStudySchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const pack = await getPackBySlug(parsed.packSlug);
  if (!pack) throw new Error('Pack not found');

  const owned = await listChildCollection(child.id, pack.id);

  let card: RevealCard | null = null;
  let cardMessage: StudyCardMessage = null;
  let xp = { gained: 0, level: 1, leveledUp: false };

  const eligible = parsed.score >= STUDY_PASS_SCORE && owned.length >= STUDY_MIN_OWNED && pack.gachaEligible;

  if (eligible) {
    try {
      const refId = `${parsed.packSlug}:${todayUtcIso()}`;
      const res = await pullCardForChild(child.id, 'study', refId, parsed.packSlug);
      if (res.granted) {
        const xpRes = await awardXp(child.id, STUDY_XP, 'study', refId);
        xp = { gained: STUDY_XP, level: xpRes.level, leveledUp: xpRes.leveledUp };
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
      } else if (res.reason === 'already_granted') {
        cardMessage = 'study_done_today';
      } else if (res.reason === 'daily_cap_reached') {
        cardMessage = 'daily_cap_reached';
      }
    } catch (err) {
      console.error('[finishStudyLessonAction] reward error:', err);
    }
  }

  // Answer-event telemetry (write-only) — guarded, after all primary writes.
  if (parsed.events?.length) {
    try {
      await logAnswerEventsSafe(child.id, null, 'study', parsed.events);
    } catch (err) {
      console.error('[finishStudyLessonAction] answer-event log failed:', err);
    }
  }

  revalidatePath(`/play/${child.id}/collection/${parsed.packSlug}`);
  return { ok: true, cardGrants: card ? [card] : [], cardMessage, xp };
}
