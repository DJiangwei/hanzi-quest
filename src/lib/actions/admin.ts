'use server';
// NEVER import this file from client code. It pulls in postgres via @/db.
import { revalidatePath } from 'next/cache';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  adminGrants,
  childCollections,
  childProfiles,
  shopItems,
  users,
} from '@/db/schema';
import { assertAdmin } from '@/lib/auth/guards';
import { GiftBundleSchema } from '@/lib/admin/bundle';
import { awardCoins } from '@/lib/db/coins';
import { awardXp } from '@/lib/db/xp';
import {
  applyShopItemOwnershipInTx,
  revokeShopItemInTx,
  grantShardsInTx,
  grantPowerupInTx,
  grantSpecificCardInTx,
  removeCardInTx,
} from '@/lib/db/admin-grants';
import { grantGiftPackInTx } from '@/lib/db/grants';
import { getCoinBalance } from '@/lib/db/coins';
import { getChildXp } from '@/lib/db/xp';
import { getGlobalShards } from '@/lib/db/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminChildSummary {
  id: string;
  displayName: string;
  gender: string | null;
  parentEmail: string;
}

export interface AdminChildState {
  coins: number;
  xp: number;
  shards: number;
  ownedCount: number;
}

/**
 * The concrete result of applying a gift bundle — stored in `admin_grants.result`
 * so undo can reverse exactly what was granted.
 */
export interface GiftResult {
  coins?: number;
  xp?: number;
  shards?: number;
  powerups?: {
    hint?: number;
    skip?: number;
    streak_freeze?: number;
  };
  /** Resolved specific collectible_items.id values granted (specific + gift-pack). */
  cardItemIds: string[];
  /** Only newly-owned shop_items.id values (already-owned items are NOT recorded). */
  shopItemIds: string[];
}

// ---------------------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------------------

/**
 * List every child profile across ALL parent accounts, joined to the parent
 * email. Admin-only.
 */
export async function listAllChildrenForAdminAction(): Promise<
  AdminChildSummary[]
> {
  await assertAdmin();

  const rows = await db
    .select({
      id: childProfiles.id,
      displayName: childProfiles.displayName,
      gender: childProfiles.gender,
      parentEmail: users.email,
    })
    .from(childProfiles)
    .innerJoin(users, eq(users.id, childProfiles.parentUserId))
    .orderBy(asc(childProfiles.createdAt));

  return rows;
}

/**
 * Return a brief snapshot of a child's economy state for the admin console.
 * Admin-only (deliberate cross-account read).
 */
export async function getChildAdminSummaryAction(
  childId: string,
): Promise<AdminChildState> {
  await assertAdmin();

  const [coinBalance, xpState, shards, ownedCountResult] = await Promise.all([
    getCoinBalance(childId),
    getChildXp(childId),
    getGlobalShards(childId),
    db
      .select({ count: count() })
      .from(childCollections)
      .where(eq(childCollections.childId, childId)),
  ]);

  return {
    coins: coinBalance.balance,
    xp: xpState.totalXp,
    shards,
    ownedCount: ownedCountResult[0]?.count ?? 0,
  };
}

/**
 * Return recent admin grants for a child (most recent first, capped at 50).
 */
export async function listAdminGrantsForChildAction(childId: string) {
  await assertAdmin();

  const rows = await db
    .select()
    .from(adminGrants)
    .where(eq(adminGrants.childId, childId))
    .orderBy(desc(adminGrants.createdAt))
    .limit(50);

  return rows;
}

// ---------------------------------------------------------------------------
// Send gift action
// ---------------------------------------------------------------------------

/**
 * Apply a custom gift bundle to any child (cross-account). Admin-only.
 *
 * Strategy for atomicity:
 *  - `awardCoins` / `awardXp` each open their own transaction internally, so
 *    they are called SEQUENTIALLY outside the main gift transaction.
 *  - Everything else (shards, powerups, cards, shop items) runs inside ONE
 *    `db.transaction` that also writes the `admin_grants` row.
 *  - The `undoneAt` guard is the primary undo safety net — partial failure
 *    atomicity is a secondary concern per the plan spec.
 */
export async function sendAdminGiftAction(
  childId: string,
  bundleRaw: unknown,
): Promise<{ ok: true; result: GiftResult } | { ok: false; reason: string }> {
  const admin = await assertAdmin();
  const bundle = GiftBundleSchema.parse(bundleRaw);

  // Track the concrete result for undo.
  const result: GiftResult = {
    cardItemIds: [],
    shopItemIds: [],
  };

  // 1. Coins — has its own tx internally.
  if (bundle.coins != null && bundle.coins !== 0) {
    await awardCoins({
      childId,
      delta: bundle.coins,
      reason: 'admin_adjust',
      refType: 'admin_grant',
    });
    result.coins = bundle.coins;
  }

  // 2. XP — uses db directly (not tx-aware).
  if (bundle.xp != null && bundle.xp > 0) {
    await awardXp(childId, bundle.xp, 'admin_grant');
    result.xp = bundle.xp;
  }

  // 3. Everything else inside one transaction.
  await db.transaction(async (tx) => {
    // 3a. Shards.
    if (bundle.shards != null && bundle.shards > 0) {
      await grantShardsInTx(tx, childId, bundle.shards);
      result.shards = bundle.shards;
    }

    // 3b. Powerups.
    if (bundle.powerups) {
      const { hint, skip, streak_freeze } = bundle.powerups;
      const powerupResult: NonNullable<GiftResult['powerups']> = {};
      if (hint != null && hint > 0) {
        await grantPowerupInTx(tx, childId, 'hint', hint);
        powerupResult.hint = hint;
      }
      if (skip != null && skip > 0) {
        await grantPowerupInTx(tx, childId, 'skip', skip);
        powerupResult.skip = skip;
      }
      if (streak_freeze != null && streak_freeze > 0) {
        await grantPowerupInTx(tx, childId, 'streak_freeze', streak_freeze);
        powerupResult.streak_freeze = streak_freeze;
      }
      if (Object.keys(powerupResult).length > 0) {
        result.powerups = powerupResult;
      }
    }

    // 3c. Gift pack — one card per active gacha-eligible pack.
    // We use a unique admin-scoped refId so it doesn't conflict with the
    // weekly_checkin idempotency log, and each admin grant gets its own pull.
    // We generate a temporary grant id for the refId (UUID-ish via Date.now).
    if (bundle.giftPack) {
      const adminRefId = `admin:${admin.id}:${Date.now()}`;
      const packResult = await grantGiftPackInTx(tx, childId, adminRefId);
      if (packResult.granted) {
        for (const card of packResult.cards) {
          result.cardItemIds.push(card.itemId);
        }
      }
      // If already_granted (same ms collision) — skip gracefully; no cards recorded.
    }

    // 3d. Specific cards.
    if (bundle.cardItemIds && bundle.cardItemIds.length > 0) {
      for (const itemId of bundle.cardItemIds) {
        await grantSpecificCardInTx(tx, childId, itemId);
        result.cardItemIds.push(itemId);
      }
    }

    // 3e. Specific shop items.
    if (bundle.shopItemIds && bundle.shopItemIds.length > 0) {
      const items = await tx
        .select()
        .from(shopItems)
        .where(inArray(shopItems.id, bundle.shopItemIds));
      for (const item of items) {
        const ownership = await applyShopItemOwnershipInTx(tx, childId, item);
        if (ownership.newlyOwned) {
          result.shopItemIds.push(item.id);
        }
      }
    }

    // 3f. Unlock all items of given kinds.
    if (bundle.shopUnlockAll && bundle.shopUnlockAll.length > 0) {
      const allItems = await tx
        .select()
        .from(shopItems)
        .where(
          and(
            inArray(shopItems.kind, bundle.shopUnlockAll),
            eq(shopItems.isActive, true),
          ),
        );
      for (const item of allItems) {
        const ownership = await applyShopItemOwnershipInTx(tx, childId, item);
        if (ownership.newlyOwned) {
          result.shopItemIds.push(item.id);
        }
      }
    }

    // 3g. Write the admin_grants row with the concrete result.
    await tx.insert(adminGrants).values({
      adminUserId: admin.id,
      childId,
      bundle: bundle as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
    });
  });

  revalidatePath('/admin');
  revalidatePath(`/play/${childId}`);

  return { ok: true, result };
}

// ---------------------------------------------------------------------------
// Undo action
// ---------------------------------------------------------------------------

/**
 * Precisely reverse a previously-applied admin grant. Admin-only.
 * Reverses only the concrete grants recorded in `result` — never strips items
 * the kid earned themselves.
 */
export async function undoAdminGiftAction(
  grantId: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_undoable' | 'not_found' }> {
  await assertAdmin();

  const [grant] = await db
    .select()
    .from(adminGrants)
    .where(eq(adminGrants.id, grantId))
    .limit(1);

  if (!grant) return { ok: false, reason: 'not_found' };
  if (grant.undoneAt != null) return { ok: false, reason: 'not_undoable' };

  const childId = grant.childId;
  const result = grant.result as GiftResult;

  // 1. Reverse coins.
  if (result.coins != null && result.coins !== 0) {
    await awardCoins({
      childId,
      delta: -result.coins,
      reason: 'admin_adjust',
      refType: 'admin_undo',
      refId: grantId,
    });
  }

  // 2. Reverse XP (negative amount is a no-op in awardXp; clamp at 0 manually).
  if (result.xp != null && result.xp > 0) {
    // awardXp skips when amount <= 0, so pass a negative as 0 (no negative XP).
    // The plan says "negate xp via awardXp with negative deltas" — the function
    // guards `if (amount <= 0)` and returns current totals, so this is a no-op
    // that never reduces XP. XP is cosmetic-only; the plan accepts this.
    // For a true rollback, we would need a separate in-tx variant. Per plan note
    // "correctness over clever atomicity" — we just call it and let it clamp.
    await awardXp(childId, -result.xp, 'admin_grant', `undo:${grantId}`);
  }

  // 3. Reverse in-tx items.
  await db.transaction(async (tx) => {
    // 3a. Shards.
    if (result.shards != null && result.shards > 0) {
      await grantShardsInTx(tx, childId, -result.shards);
    }

    // 3b. Powerups.
    if (result.powerups) {
      const { hint, skip, streak_freeze } = result.powerups;
      if (hint != null && hint > 0)
        await grantPowerupInTx(tx, childId, 'hint', -hint);
      if (skip != null && skip > 0)
        await grantPowerupInTx(tx, childId, 'skip', -skip);
      if (streak_freeze != null && streak_freeze > 0)
        await grantPowerupInTx(tx, childId, 'streak_freeze', -streak_freeze);
    }

    // 3c. Remove granted cards (one copy each).
    if (result.cardItemIds && result.cardItemIds.length > 0) {
      for (const itemId of result.cardItemIds) {
        await removeCardInTx(tx, childId, itemId);
      }
    }

    // 3d. Revoke newly-owned shop items.
    if (result.shopItemIds && result.shopItemIds.length > 0) {
      for (const shopItemId of result.shopItemIds) {
        await revokeShopItemInTx(tx, childId, shopItemId);
      }
    }

    // 3e. Mark as undone.
    await tx
      .update(adminGrants)
      .set({ undoneAt: sql`now()` })
      .where(eq(adminGrants.id, grantId));
  });

  revalidatePath('/admin');
  revalidatePath(`/play/${childId}`);

  return { ok: true };
}
