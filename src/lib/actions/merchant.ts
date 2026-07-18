'use server';

// E2 旅行商人 — buy today's fixed-price card. Auth-gated at entry (PR #112
// rule: every exported action validates its own caller).

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { todayUtcIso } from '@/lib/db/streaks';
import { buyMerchantOffer, getMerchantOffer } from '@/lib/db/merchant';
import { safePackCompleteTrophy } from '@/lib/play/card-grants';
import type { MerchantPurchaseOutcome } from '@/lib/merchant/offer';

export async function buyMerchantOfferAction(
  childId: string,
  expectedItemId: string,
): Promise<MerchantPurchaseOutcome> {
  const { child } = await requireChild(childId);
  const dayUtc = todayUtcIso();

  // Server-authoritative: recompute the offer, never trust the client's card.
  const offer = await getMerchantOffer(child.id, dayUtc);
  if (!offer) return { ok: false, reason: 'no_offer' };

  const outcome = await buyMerchantOffer(child.id, dayUtc, offer, expectedItemId);

  if (outcome.ok) {
    revalidatePath(`/play/${child.id}`);
    revalidatePath(`/play/${child.id}/collection`);
    revalidatePath(`/play/${child.id}/collection/${outcome.card.packSlug}`);
    // Guarded fire-and-forget — trophy bookkeeping never breaks the buy.
    void safePackCompleteTrophy(child.id, outcome.card.packSlug);
  }
  return outcome;
}
