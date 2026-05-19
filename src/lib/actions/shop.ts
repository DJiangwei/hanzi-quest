'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  equipAvatarItem,
  purchaseShopItem,
  type PurchaseResult,
} from '@/lib/db/shop';

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
