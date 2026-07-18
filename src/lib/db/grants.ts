// NEVER import this file from client code. It pulls in postgres.
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childCardGrantsDaily, cardGrantsLog } from '@/db/schema/gacha';
import {
  childCollections,
  childShards,
  collectibleItems,
  collectionPacks,
} from '@/db/schema/collections';
import { SHARD_SWAP_COST, shardSwapCostForPack } from '@/lib/economy/shards';

export const WEEKLY_CARD_CAP = 10; // dead since card-economy-v2 — daily cap replaced it
export const DAILY_CARD_CAP = 10;
// SHARD_SWAP_COST (regular packs) now lives in '@/lib/economy/shards' (shared
// with the client). Re-exported here for existing importers.
export { SHARD_SWAP_COST };

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface WeightedItem {
  id: string;
  packId: string;
  dropWeight: number;
}

export function weightedRandomPick<T extends WeightedItem>(
  items: T[],
  ownedSet: Set<string>,
  rng: () => number = Math.random,
): T {
  if (items.length === 0) {
    throw new Error('weightedRandomPick called with empty catalog');
  }

  // Bias by per-pack unowned count.
  const packUnowned = new Map<string, number>();
  for (const item of items) {
    if (!ownedSet.has(item.id)) {
      packUnowned.set(item.packId, (packUnowned.get(item.packId) ?? 0) + 1);
    }
  }

  const weights = items.map(
    (item) => item.dropWeight * (1 + (packUnowned.get(item.packId) ?? 0)),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // Catalog has no items with positive drop weight (e.g. all retired).
    // This is unexpected in normal operation — fail loudly rather than silently
    // re-enable retired items.
    throw new Error(
      'weightedRandomPick: no items with positive dropWeight in catalog',
    );
  }

  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1]; // float-rounding safety net
}

export interface CardGrantResult {
  granted: true;
  itemId: string;
  packId: string;
  packSlug: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  isDupe: boolean;
  shardsAfter: number;
  cardsToday: number;
}

export interface CardGrantSkipped {
  granted: false;
  reason: 'daily_cap_reached' | 'already_granted';
  cardsToday: number;
}

/**
 * Inside a transaction:
 *  1. SELECT child_card_grants_daily (FOR UPDATE).
 *  2. If count >= cap → return skipped.
 *  3. INSERT card_grants_log; if PK collision → already_granted.
 *  4. Pick weighted random item.
 *  5. Upsert child_collections (count++).
 *  6. If was dupe → shard_balances++.
 *  7. Increment/insert daily counter.
 */
export async function pullCardInTx(
  tx: Tx,
  childId: string,
  source: 'boss_clear' | 'perfect_week' | 'story_chapter' | 'review' | 'practice' | 'homework' | 'study' | 'bounty',
  refId: string,
  dayUtc: string,
  rng: () => number = Math.random,
  packSlug?: string,
): Promise<CardGrantResult | CardGrantSkipped> {
  // 1. Daily counter with row lock.
  const dailyRows = await tx
    .select({ count: childCardGrantsDaily.count })
    .from(childCardGrantsDaily)
    .where(
      and(
        eq(childCardGrantsDaily.childId, childId),
        eq(childCardGrantsDaily.dayUtc, dayUtc),
      ),
    )
    .for('update');
  const currentCount = dailyRows[0]?.count ?? 0;

  if (currentCount >= DAILY_CARD_CAP) {
    return { granted: false, reason: 'daily_cap_reached', cardsToday: currentCount };
  }

  // 2. Idempotency log — INSERT with PK collision → already granted.
  try {
    await tx.insert(cardGrantsLog).values({ childId, source, refId });
  } catch (err) {
    // Postgres unique_violation (23505)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return { granted: false, reason: 'already_granted', cardsToday: currentCount };
    }
    throw err;
  }

  // 3. Pick weighted random item from all active packs.
  const catalog = await tx
    .select({
      id: collectibleItems.id,
      packId: collectibleItems.packId,
      packSlug: collectionPacks.slug,
      slug: collectibleItems.slug,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh,
      loreEn: collectibleItems.loreEn,
      dropWeight: collectibleItems.dropWeight,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
        packSlug ? eq(collectionPacks.slug, packSlug) : undefined,
      ),
    );

  const owned = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(eq(childCollections.childId, childId));
  const ownedSet = new Set(owned.map((o) => o.itemId));

  const picked = weightedRandomPick(catalog, ownedSet, rng);
  const isDupe = ownedSet.has(picked.id);

  // 4. Upsert child_collections. Duplicates only bump the ×N count — shards are
  //    no longer auto-granted (2026-06-07 economy redesign: the kid manually
  //    converts spare duplicates to shards via convertDuplicateInTx).
  if (isDupe) {
    await tx
      .update(childCollections)
      .set({ count: sql`${childCollections.count} + 1` })
      .where(
        and(
          eq(childCollections.childId, childId),
          eq(childCollections.itemId, picked.id),
        ),
      );
  } else {
    await tx.insert(childCollections).values({ childId, itemId: picked.id, count: 1 });
  }

  // 6. Increment daily counter (upsert — safe for first-of-day race)
  await tx
    .insert(childCardGrantsDaily)
    .values({ childId, dayUtc, count: 1 })
    .onConflictDoUpdate({
      target: [childCardGrantsDaily.childId, childCardGrantsDaily.dayUtc],
      set: { count: sql`${childCardGrantsDaily.count} + 1` },
    });

  return {
    granted: true,
    itemId: picked.id,
    packId: picked.packId,
    packSlug: picked.packSlug,
    slug: picked.slug,
    nameZh: picked.nameZh,
    nameEn: picked.nameEn,
    loreZh: picked.loreZh,
    loreEn: picked.loreEn,
    isDupe,
    shardsAfter: 0, // shards are no longer auto-granted on dupe — see redesign note
    cardsToday: currentCount + 1,
  };
}

export const WEEKLY_GIFT_SOURCE = 'weekly_checkin';

export interface GiftCard {
  itemId: string;
  packId: string;
  packSlug: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  isDupe: boolean;
  shardsAfter: number;
}
export type GiftPackResult =
  | { granted: true; cards: GiftCard[] }
  | { granted: false; reason: 'already_granted' };

/**
 * Weekly check-in gift pack: ONE card per ACTIVE pack, BYPASSING the daily
 * cap (never reads/writes child_card_grants_daily). Idempotent per
 * (child, weekStartUtc) via cardGrantsLog. Each pick uses weightedRandomPick
 * scoped to a single pack; a dupe pick grants 1 shard.
 */
export async function grantGiftPackInTx(
  tx: Tx,
  childId: string,
  weekStartUtc: string,
  rng: () => number = Math.random,
): Promise<GiftPackResult> {
  // 1. Idempotency guard — once per week.
  try {
    await tx.insert(cardGrantsLog).values({ childId, source: WEEKLY_GIFT_SOURCE, refId: weekStartUtc });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
      return { granted: false, reason: 'already_granted' };
    }
    throw err;
  }

  // 2. Active, gacha-eligible packs (reward-only packs like festivals are excluded).
  const packs = await tx
    .select({ id: collectionPacks.id, slug: collectionPacks.slug })
    .from(collectionPacks)
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
      ),
    );

  // 3. Owned set (once, shared across all pack iterations).
  const owned = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(eq(childCollections.childId, childId));
  const ownedSet = new Set(owned.map((o) => o.itemId));

  const cards: GiftCard[] = [];
  for (const pack of packs) {
    // 4. Catalog for this pack.
    const catalog = await tx
      .select({
        id: collectibleItems.id,
        packId: collectibleItems.packId,
        packSlug: collectionPacks.slug,
        slug: collectibleItems.slug,
        nameZh: collectibleItems.nameZh,
        nameEn: collectibleItems.nameEn,
        loreZh: collectibleItems.loreZh,
        loreEn: collectibleItems.loreEn,
        dropWeight: collectibleItems.dropWeight,
      })
      .from(collectibleItems)
      .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
      .where(eq(collectibleItems.packId, pack.id));
    if (catalog.length === 0) continue;

    const picked = weightedRandomPick(catalog, ownedSet, rng);
    const isDupe = ownedSet.has(picked.id);

    // 5. Upsert child_collections. Duplicates only bump ×N — no auto shards.
    if (isDupe) {
      await tx
        .update(childCollections)
        .set({ count: sql`${childCollections.count} + 1` })
        .where(and(eq(childCollections.childId, childId), eq(childCollections.itemId, picked.id)));
    } else {
      await tx.insert(childCollections).values({ childId, itemId: picked.id, count: 1 });
      ownedSet.add(picked.id);
    }

    cards.push({ itemId: picked.id, packId: picked.packId, packSlug: picked.packSlug, slug: picked.slug, nameZh: picked.nameZh, nameEn: picked.nameEn, loreZh: picked.loreZh, loreEn: picked.loreEn, isDupe, shardsAfter: 0 });
  }

  return { granted: true, cards };
}

/** Read a child's universal shard wallet (0 if no row yet). */
export async function getGlobalShards(childId: string): Promise<number> {
  const rows = await db
    .select({ shards: childShards.shards })
    .from(childShards)
    .where(eq(childShards.childId, childId));
  return rows[0]?.shards ?? 0;
}

/**
 * Convert one spare DUPLICATE of `itemId` into 1 universal shard.
 * Requires the child to own the item with count >= 2 (can't scrap the last
 * copy). Decrements the ×N count by 1 and adds +1 to the global wallet.
 */
export async function convertDuplicateInTx(
  tx: Tx,
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; count: number; shards: number }
  | { ok: false; reason: 'no_duplicate' }
> {
  const owned = await tx
    .select({ count: childCollections.count })
    .from(childCollections)
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, itemId),
      ),
    )
    .for('update');
  const count = owned[0]?.count ?? 0;
  if (count < 2) return { ok: false, reason: 'no_duplicate' };

  await tx
    .update(childCollections)
    .set({ count: sql`${childCollections.count} - 1` })
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, itemId),
      ),
    );

  const [walletRow] = await tx
    .insert(childShards)
    .values({ childId, shards: 1 })
    .onConflictDoUpdate({
      target: childShards.childId,
      set: { shards: sql`${childShards.shards} + 1` },
    })
    .returning({ shards: childShards.shards });

  return { ok: true, count: count - 1, shards: walletRow?.shards ?? 1 };
}

/**
 * Trade universal shards for a chosen unowned item. The cost is per-pack:
 * regular packs cost `SHARD_SWAP_COST` (3); the reward-only limited packs
 * (festival + season) cost `SHARD_SWAP_COST_EXCLUSIVE` (12) — see
 * `@/lib/economy/shards`. The cost is derived from the TARGET item's pack so the
 * charge matches the cost the client displays for that pack.
 */
export async function swapShardsInTx(
  tx: Tx,
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; shardsRemaining: number }
  | {
      ok: false;
      reason: 'insufficient_shards' | 'already_owned' | 'item_not_found';
    }
> {
  const items = await tx
    .select({ id: collectibleItems.id, packSlug: collectionPacks.slug })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(eq(collectibleItems.id, itemId));
  if (items.length === 0) return { ok: false, reason: 'item_not_found' };
  const cost = shardSwapCostForPack(items[0].packSlug);

  const owned = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, itemId),
      ),
    );
  if (owned.length > 0) return { ok: false, reason: 'already_owned' };

  const balRows = await tx
    .select({ shards: childShards.shards })
    .from(childShards)
    .where(eq(childShards.childId, childId))
    .for('update');
  const shards = balRows[0]?.shards ?? 0;
  if (shards < cost) return { ok: false, reason: 'insufficient_shards' };

  await tx
    .update(childShards)
    .set({ shards: shards - cost })
    .where(eq(childShards.childId, childId));
  await tx.insert(childCollections).values({ childId, itemId, count: 1 });

  return { ok: true, shardsRemaining: shards - cost };
}
