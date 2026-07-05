'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { collectibleItems, collectionPacks } from '@/db/schema/collections';
import { requireChild } from '@/lib/auth/guards';
import type { GrantedTrophy } from '@/lib/db/trophies';
import { grantContinentRewards } from '@/lib/db/continent-rewards';
import { swapShardsInTx, convertDuplicateInTx } from '@/lib/db/grants';
import { safePackCompleteTrophy } from '@/lib/play/card-grants';

// The legacy gacha endpoints (pullFreeFromBoss / pullPaid) were deleted in the
// 2026-07-05 cleanup — cards flow exclusively through the play-to-earn grants
// in src/lib/play/card-grants.ts (PR #52 economy).

export async function swapShardsForItem(
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; shardsRemaining: number; continentTrophies: GrantedTrophy[] }
  | { ok: false; reason: 'insufficient_shards' | 'already_owned' | 'item_not_found' }
> {
  const { child } = await requireChild(childId);
  const result = await db.transaction((tx) => swapShardsInTx(tx, child.id, itemId));
  if (!result.ok) return result;

  revalidatePath(`/play/${child.id}/collection`);
  let continentTrophies: GrantedTrophy[] = [];
  // Resolve the swapped item's pack and check pack/continent completion. Guarded
  // — a secondary-lookup failure must never break a successful swap.
  try {
    const item = await db
      .select({ packSlug: collectionPacks.slug })
      .from(collectibleItems)
      .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
      .where(eq(collectibleItems.id, itemId));
    const packSlug = item[0]?.packSlug;
    if (packSlug) {
      revalidatePath(`/play/${child.id}/collection/${packSlug}`);
      void safePackCompleteTrophy(child.id, packSlug);
      if (packSlug === 'flags-v1') {
        continentTrophies = await grantContinentRewards(child.id);
      }
    }
  } catch (err) {
    console.error('[gacha] swap completion check failed:', err);
  }
  return { ok: true, shardsRemaining: result.shardsRemaining, continentTrophies };
}

/**
 * Convert one spare DUPLICATE of `itemId` into 1 universal shard. User-tappable
 * → requires auth (requireChild). Rejects when the child has no spare copy.
 */
export async function convertDuplicateToShard(
  childId: string,
  itemId: string,
): Promise<{ ok: true; count: number; shards: number } | { ok: false; reason: 'no_duplicate' }> {
  const { child } = await requireChild(childId);
  const result = await db.transaction((tx) => convertDuplicateInTx(tx, child.id, itemId));
  if (result.ok) {
    revalidatePath(`/play/${child.id}/collection`);
  }
  return result;
}
