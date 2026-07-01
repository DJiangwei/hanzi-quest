'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireChild } from '@/lib/auth/guards';
import { db } from '@/db';
import { shopItems } from '@/db/schema';
import { equipAvatarItem, purchaseShopItem } from '@/lib/db/shop';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import type { GrantedTrophy } from '@/lib/db/trophies';
import { tickQuestProgressSafe } from '@/lib/db/quests';
import {
  AlreadyOwnedError,
  InsufficientCoinsError,
} from '@/lib/errors/shop-errors';

// Error classes are NOT re-exported here — 'use server' files may only export
// async functions. Client components import from '@/lib/errors/shop-errors'.

interface ChildArgs {
  childId: string;
}

/**
 * Discriminated purchase outcome. We RETURN a status instead of throwing the
 * expected errors because thrown error classes lose their identity across the
 * server-action RPC boundary (the client can't reliably `instanceof` them).
 * Unexpected errors still throw.
 */
export type PurchaseOutcome =
  | { status: 'purchased'; trophies: GrantedTrophy[] }
  | { status: 'already_owned' }
  | { status: 'insufficient'; required: number; available: number };

export async function purchaseShopItemAction(
  shopItemId: string,
  args: ChildArgs,
): Promise<PurchaseOutcome> {
  const { child } = await requireChild(args.childId);

  try {
    const result = await purchaseShopItem(child.id, shopItemId);

    // Post-commit: read the purchased item's kind + priceCoins.
    // Reading from db here (instead of threading through the tx) keeps the
    // purchase tx focused and avoids a circular import (db/shop ↔ db/trophies).
    const [item] = await db
      .select({ kind: shopItems.kind, priceCoins: shopItems.priceCoins })
      .from(shopItems)
      .where(eq(shopItems.id, shopItemId))
      .limit(1);
    if (item?.kind === 'decor') {
      result.trophies = await checkAndGrantTrophies(child.id, {
        kind: 'decor-purchase',
      });
    }

    // Additive, guarded, fire-and-forget: tick spend_coins quest by amount spent.
    // A failure here must never break the purchase response.
    if (item?.priceCoins && item.priceCoins > 0) {
      void tickQuestProgressSafe(child.id, 'spend_coins', item.priceCoins);
    }

    revalidatePath(`/play/${child.id}`);
    revalidatePath(`/play/${child.id}/shop`);
    return { status: 'purchased', trophies: result.trophies ?? [] };
  } catch (e) {
    if (e instanceof AlreadyOwnedError) {
      return { status: 'already_owned' };
    }
    if (e instanceof InsufficientCoinsError) {
      return { status: 'insufficient', required: e.required, available: e.available };
    }
    throw e;
  }
}

export async function equipAvatarItemAction(
  avatarItemId: string,
  args: ChildArgs,
): Promise<void> {
  const { child } = await requireChild(args.childId);
  await equipAvatarItem(child.id, avatarItemId);

  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/shop`);
}
