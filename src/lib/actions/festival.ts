'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  claimFestivalReward,
  type FestivalClaimResult,
} from '@/lib/db/festival-challenge';

/**
 * Claim the month's festival challenge reward (the festival card). User-tappable
 * → auth-gated via `requireChild`. Idempotent server-side; revalidates the
 * calendar + Backpack so the claimed state + new card show on next render.
 */
export async function claimFestivalRewardAction(
  childId: string,
  yyyymm: string,
): Promise<FestivalClaimResult> {
  await requireChild(childId);
  const result = await claimFestivalReward(childId, yyyymm);
  if (result.granted) {
    revalidatePath(`/play/${childId}/calendar`);
    revalidatePath(`/play/${childId}/collection`);
    // The cosmetic is auto-equipped — refresh the surfaces that render the avatar.
    revalidatePath(`/play/${childId}`);
    revalidatePath(`/play/${childId}/shop`);
  }
  return result;
}
