'use server';

// T2 通缉令 — claim a completed wanted poster. Auth-gated at entry (PR #112
// rule). Coins are paid in the claim tx; the all-3 bounty card rides the
// normal grants engine (consumes the daily cap; idempotent via grants log).

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { db } from '@/db';
import { todayUtcIso } from '@/lib/db/streaks';
import { claimBountyInTx } from '@/lib/db/bounties';
import { awardXp } from '@/lib/db/xp';
import { pullCardForChild } from '@/lib/play/card-grants';
import { BOUNTY_REWARD_XP } from '@/lib/bounty/ranking';
import type { RevealCard } from '@/lib/play/reveal-card';

export type ClaimBountyOutcome =
  | { ok: true; coins: number; card: RevealCard | null }
  | { ok: false; reason: 'not_found' | 'not_ready' | 'already_claimed' };

export async function claimBountyAction(
  childId: string,
  characterId: string,
): Promise<ClaimBountyOutcome> {
  const { child } = await requireChild(childId);
  const dayUtc = todayUtcIso();

  const result = await db.transaction((tx) =>
    claimBountyInTx(tx, child.id, dayUtc, characterId),
  );
  if (!result.ok) return result;

  // XP + the all-3 card are additive extras — guarded so they never undo a
  // successful claim.
  try {
    await awardXp(child.id, BOUNTY_REWARD_XP, 'bounty_claim', `${dayUtc}:${characterId}`);
  } catch (err) {
    console.error('[claimBountyAction] xp award failed:', err);
  }

  let card: RevealCard | null = null;
  if (result.allClaimedToday) {
    try {
      const pull = await pullCardForChild(child.id, 'bounty', dayUtc);
      if (pull.granted) {
        card = {
          id: pull.itemId,
          slug: pull.slug,
          packSlug: pull.packSlug,
          nameZh: pull.nameZh,
          nameEn: pull.nameEn,
          loreZh: pull.loreZh,
          loreEn: pull.loreEn,
          isDupe: pull.isDupe,
          shardsAfter: pull.shardsAfter,
        };
      }
    } catch (err) {
      console.error('[claimBountyAction] bounty card pull failed:', err);
    }
  }

  revalidatePath(`/play/${child.id}`);
  return { ok: true, coins: result.coins, card };
}
