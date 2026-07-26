// NEVER import this file from client code — it pulls in postgres.
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cardGrantsLog, collectibleItems, collectionPacks } from '@/db/schema';
import { grantSpecificCardInTx } from '@/lib/db/admin-grants';
import { awardCoins } from '@/lib/db/coins';
import {
  KEY_VAULT_COIN_PRIZE,
  KEY_VAULT_PACK_SLUG,
  MAP_TO_VAULT_CARD,
} from '@/lib/collections/keyVaultData';
import type { RevealCard } from '@/lib/play/reveal-card';

/** `card_grants_log.source` for the once-per-map vault prize. Plain text column
 *  — no enum migration needed for a new source (unlike `coin_reason`). */
export const KEY_VAULT_SOURCE = 'key_vault';

export interface KeyVaultPrize {
  card: RevealCard | null;
  coins: number;
}

/**
 * 🗝️ Key Vault grand prize (T3): paid ONCE per (child, map) the moment the last
 * key lands — i.e. every weekly boss on the map is beaten. The caller decides
 * WHEN to check ("did this boss clear complete the map?"); this function owns
 * idempotency and the grant.
 *
 * Idempotency is the `card_grants_log` insert on (child, 'key_vault', packId):
 * a 23505 collision means the vault was already opened, and nothing is paid.
 * The insert happens FIRST so a duplicate can never double-pay, and it
 * deliberately BYPASSES the 10/day card cap (`pullCardInTx`) — a once-per-map
 * milestone must never be eaten by a busy day, same reasoning as the weekly
 * 大礼包 and the shard swap.
 *
 * Returns `{ card: null, coins: 0 }` when already claimed, when the map has no
 * vault treasure mapped, or when the pack isn't seeded yet (run
 * `scripts/seed-key-vault-pack.ts`) — an unseeded pack must degrade quietly,
 * never break a boss clear.
 */
export async function claimKeyVaultPrize(
  childId: string,
  packId: string,
  packSlug: string,
): Promise<KeyVaultPrize> {
  const empty: KeyVaultPrize = { card: null, coins: 0 };

  const cardSlug = MAP_TO_VAULT_CARD[packSlug];
  if (!cardSlug) return empty;

  const itemRows = await db
    .select({
      id: collectibleItems.id,
      slug: collectibleItems.slug,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh,
      loreEn: collectibleItems.loreEn,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(
      and(
        eq(collectionPacks.slug, KEY_VAULT_PACK_SLUG),
        eq(collectibleItems.slug, cardSlug),
      ),
    )
    .limit(1);
  const item = itemRows[0];
  if (!item) return empty; // pack not seeded — degrade quietly

  // Claim the vault: the log insert IS the lock. Do it inside the same tx as
  // the card grant so a failure mid-way can't consume the one-shot claim.
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(cardGrantsLog)
        .values({ childId, source: KEY_VAULT_SOURCE, refId: packId });
      await grantSpecificCardInTx(tx, childId, item.id);
    });
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return empty; // already opened this map's vault
    }
    throw err;
  }

  await awardCoins({
    childId,
    delta: KEY_VAULT_COIN_PRIZE,
    reason: 'key_vault',
    refType: 'pack',
    refId: packId,
  });

  return {
    card: {
      id: item.id,
      slug: item.slug,
      packSlug: KEY_VAULT_PACK_SLUG,
      nameZh: item.nameZh,
      nameEn: item.nameEn,
      loreZh: item.loreZh,
      loreEn: item.loreEn,
      isDupe: false,
      shardsAfter: 0,
    },
    coins: KEY_VAULT_COIN_PRIZE,
  };
}
