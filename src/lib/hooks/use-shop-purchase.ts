'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import type { GrantedTrophy } from '@/lib/db/trophies';

export type ShopFeedbackKind = 'success' | 'owned' | 'insufficient' | 'error';

export interface ShopFeedback {
  kind: ShopFeedbackKind;
}

/**
 * Shared purchase flow for every shop tab. Calls the discriminated
 * `purchaseShopItemAction`, maps the outcome to a friendly feedback kind (so an
 * already-owned re-tap is a gentle "you already own this", NOT a red error),
 * and refreshes the router on a real purchase. `onPurchased` runs only on a
 * genuine purchase, receiving any granted trophies (used by the decor tab).
 */
export function useShopPurchase(childId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<ShopFeedback | null>(null);

  const purchase = (
    shopItemId: string,
    onPurchased?: (trophies: GrantedTrophy[]) => void,
  ) => {
    start(async () => {
      try {
        const res = await purchaseShopItemAction(shopItemId, { childId });
        if (res.status === 'purchased') {
          setFeedback({ kind: 'success' });
          onPurchased?.(res.trophies);
          router.refresh();
        } else if (res.status === 'already_owned') {
          setFeedback({ kind: 'owned' });
        } else {
          setFeedback({ kind: 'insufficient' });
        }
      } catch {
        setFeedback({ kind: 'error' });
      }
    });
  };

  return {
    purchase,
    pending,
    feedback,
    clearFeedback: () => setFeedback(null),
  };
}
