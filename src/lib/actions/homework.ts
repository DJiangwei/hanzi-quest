'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { pullCardForChild } from '@/lib/actions/gacha';
import { awardCoins } from '@/lib/db/coins';
import { awardXp } from '@/lib/db/xp';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import { todayUtcIso } from '@/lib/db/streaks';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { CardSkipReason } from '@/lib/actions/play';

const HOMEWORK_COMPLETE_COINS = 80;
const HOMEWORK_XP = 30;

const FinishHomeworkSchema = z.object({
  childId: z.string(),
  weekId: z.string(),
});

export async function finishHomeworkAction(
  input: z.input<typeof FinishHomeworkSchema>,
): Promise<{
  ok: true;
  cardGrants: RevealCard[];
  cardMessage: CardSkipReason | 'homework_done_today' | null;
  xp: { gained: number; level: number; leveledUp: boolean };
}> {
  const parsed = FinishHomeworkSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  const week = await getPlayableWeekForChild(child.id, parsed.weekId);
  if (!week) throw new Error('Week not playable for this child');

  const dayUtc = todayUtcIso();
  const refId = `${parsed.weekId}:${dayUtc}`;

  let card: RevealCard | null = null;
  let cardMessage: CardSkipReason | 'homework_done_today' | null = null;
  let xp = { gained: 0, level: 1, leveledUp: false };

  try {
    const res = await pullCardForChild(child.id, 'homework', refId);
    if (res.granted) {
      await awardCoins({
        childId: child.id,
        delta: HOMEWORK_COMPLETE_COINS,
        reason: 'homework_complete',
        refType: 'week_day',
        refId,
      });
      const xpRes = await awardXp(child.id, HOMEWORK_XP, 'homework', refId);
      xp = { gained: HOMEWORK_XP, level: xpRes.level, leveledUp: xpRes.leveledUp };
      // Additive, guarded, fire-and-forget — tick earn_card quest progress.
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
      cardMessage = 'homework_done_today';
    } else if (res.reason === 'daily_cap_reached') {
      cardMessage = 'daily_cap_reached';
    }
  } catch (err) {
    console.error('[finishHomeworkAction] reward error:', err);
  }

  revalidatePath(`/play/${child.id}/week/${parsed.weekId}`);
  return { ok: true, cardGrants: card ? [card] : [], cardMessage, xp };
}
