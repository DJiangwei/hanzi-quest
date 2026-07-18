// E2 旅行商人 Traveling Merchant — server-side offer derivation + purchase.
//
// The daily offer is DERIVED, never stored: a deterministic pick from the
// child's unowned cards across active gacha-eligible packs. Purchase
// idempotency is a cardGrantsLog row ('merchant', dayUtc) — one buy per UTC
// day. Like the shard swap, a merchant buy deliberately BYPASSES the 10/day
// card cap: it's coin-funded (effort already earned), not a free drop.

import { and, asc, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cardGrantsLog } from '@/db/schema/gacha';
import {
  childCollections,
  collectibleItems,
  collectionPacks,
} from '@/db/schema/collections';
import { awardCoinsInTx } from '@/lib/db/coins';
import { coinBalances } from '@/db/schema';
import {
  merchantPriceForRarity,
  pickMerchantIndex,
  type MerchantOffer,
  type MerchantPurchaseOutcome,
} from '@/lib/merchant/offer';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

/**
 * Today's offer for a child, or null when she owns every gacha-eligible card.
 * Pool ordering is stable (pack slug, then item slug) so the deterministic
 * index maps to the same card for the whole UTC day — unless the pool itself
 * shifts (she gained a card), which the purchase path detects via
 * `expectedItemId`.
 */
export async function getMerchantOffer(
  childId: string,
  dayUtc: string,
): Promise<MerchantOffer | null> {
  const ownedRows = await db
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(eq(childCollections.childId, childId));
  const ownedIds = ownedRows.map((r) => r.itemId);

  const pool = await db
    .select({
      itemId: collectibleItems.id,
      slug: collectibleItems.slug,
      packSlug: collectionPacks.slug,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh,
      loreEn: collectibleItems.loreEn,
      rarity: collectibleItems.rarity,
      imageUrl: collectibleItems.imageUrl,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(
      and(
        eq(collectionPacks.isActive, true),
        eq(collectionPacks.gachaEligible, true),
        ...(ownedIds.length > 0
          ? [notInArray(collectibleItems.id, ownedIds)]
          : []),
      ),
    )
    .orderBy(asc(collectionPacks.slug), asc(collectibleItems.slug));

  if (pool.length === 0) return null;
  const picked = pool[pickMerchantIndex(childId, dayUtc, pool.length)];
  return { ...picked, price: merchantPriceForRarity(picked.rarity) };
}

/** Has the child already bought from the merchant today? */
export async function hasBoughtMerchantToday(
  childId: string,
  dayUtc: string,
): Promise<boolean> {
  const rows = await db
    .select({ refId: cardGrantsLog.refId })
    .from(cardGrantsLog)
    .where(
      and(
        eq(cardGrantsLog.childId, childId),
        eq(cardGrantsLog.source, 'merchant'),
        eq(cardGrantsLog.refId, dayUtc),
      ),
    );
  return rows.length > 0;
}

/**
 * Buy today's offer. The caller (server action) recomputes the offer and
 * passes it here with the client's `expectedItemId` — a mismatch means the
 * pool shifted mid-day (she gained that card another way) and the UI should
 * refresh rather than sell a surprise card.
 */
export async function buyMerchantOffer(
  childId: string,
  dayUtc: string,
  offer: MerchantOffer,
  expectedItemId: string,
): Promise<MerchantPurchaseOutcome> {
  if (offer.itemId !== expectedItemId) return { ok: false, reason: 'offer_changed' };

  try {
    return await db.transaction(async (tx): Promise<MerchantPurchaseOutcome> => {
      // 1. One-per-day guard — PK (child, source, refId) collision → bought.
      await tx.insert(cardGrantsLog).values({
        childId,
        source: 'merchant',
        refId: dayUtc,
      });

      // 2. Coin check + debit.
      const balRows = await tx
        .select({ balance: coinBalances.balance })
        .from(coinBalances)
        .where(eq(coinBalances.childId, childId))
        .for('update');
      const balance = balRows[0]?.balance ?? 0;
      if (balance < offer.price) {
        // Roll back the log row too — an unaffordable tap must not burn the day.
        throw new InsufficientMerchantCoins(offer.price, balance);
      }
      await awardCoinsInTx(tx, {
        childId,
        delta: -offer.price,
        reason: 'merchant_purchase',
        refType: 'merchant_offer',
        refId: dayUtc,
      });

      // 3. Grant the card. The pool excluded owned items, but a same-moment
      // grant elsewhere could race — upsert so a dupe just bumps ×N.
      await tx
        .insert(childCollections)
        .values({ childId, itemId: offer.itemId, count: 1 })
        .onConflictDoUpdate({
          target: [childCollections.childId, childCollections.itemId],
          set: { count: sql`${childCollections.count} + 1` },
        });

      return {
        ok: true,
        card: {
          id: offer.itemId,
          slug: offer.slug,
          packSlug: offer.packSlug,
          nameZh: offer.nameZh,
          nameEn: offer.nameEn,
          loreZh: offer.loreZh,
          loreEn: offer.loreEn,
          isDupe: false,
          shardsAfter: 0,
        },
        balanceAfter: balance - offer.price,
      };
    });
  } catch (err) {
    if (err instanceof InsufficientMerchantCoins) {
      return {
        ok: false,
        reason: 'insufficient_coins',
        price: err.price,
        balance: err.balance,
      };
    }
    if (isUniqueViolation(err)) return { ok: false, reason: 'already_bought_today' };
    throw err;
  }
}

/** Internal control-flow error: aborts the tx so the day-guard row rolls back. */
class InsufficientMerchantCoins extends Error {
  constructor(
    readonly price: number,
    readonly balance: number,
  ) {
    super('insufficient coins for merchant offer');
  }
}
