'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireChild } from '@/lib/auth/guards';
import { db } from '@/db';
import { shopItems } from '@/db/schema';
import {
  equipAvatarItem,
  purchaseShopItem,
  type PurchaseResult,
} from '@/lib/db/shop';
import { checkAndGrantTrophies } from '@/lib/db/trophies';

// Error classes are NOT re-exported here — 'use server' files may only export
// async functions. Client components import from '@/lib/errors/shop-errors'.

interface ChildArgs {
  childId: string;
}

export async function purchaseShopItemAction(
  shopItemId: string,
  args: ChildArgs,
): Promise<PurchaseResult> {
  const { child } = await requireChild(args.childId);
  const result = await purchaseShopItem(child.id, shopItemId);

  // Post-commit: read the purchased item's kind to dispatch trophy grants.
  // Reading from db here (instead of threading through the tx) keeps the
  // purchase tx focused and avoids a circular import (db/shop ↔ db/trophies).
  const [item] = await db
    .select({ kind: shopItems.kind })
    .from(shopItems)
    .where(eq(shopItems.id, shopItemId))
    .limit(1);
  if (item?.kind === 'decor') {
    result.trophies = await checkAndGrantTrophies(child.id, {
      kind: 'decor-purchase',
    });
  }

  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/shop`);
  return result;
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
