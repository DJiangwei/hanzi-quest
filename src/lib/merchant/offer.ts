// E2 旅行商人 Traveling Merchant — pure, client-safe helpers (no db imports).
//
// The merchant sells ONE fixed, visible card per (child, UTC day) at a steep
// coin price. This is deliberately NOT a coin gacha (deleted 2026-07-05): no
// randomness at purchase time — the kid sees exactly which card is on offer
// and saves toward it. The offer is derived deterministically so the server
// can recompute + verify it on purchase without storing anything.

import type { RevealCard } from '@/lib/play/reveal-card';

export type MerchantRarity = 'common' | 'rare' | 'epic';

/** Steep by design: ~2–3 days of net coin income per card. */
export const MERCHANT_PRICES: Record<MerchantRarity, number> = {
  common: 800,
  rare: 1200,
  epic: 1800,
};

export function merchantPriceForRarity(rarity: string): number {
  return MERCHANT_PRICES[(rarity as MerchantRarity)] ?? MERCHANT_PRICES.common;
}

/**
 * Deterministic index into a stably-ordered pool for (childId, dayUtc).
 * FNV-1a over the combined key — stable across processes, no Math.random().
 */
export function pickMerchantIndex(
  childId: string,
  dayUtc: string,
  poolSize: number,
): number {
  if (poolSize <= 0) return 0;
  const key = `${childId}:${dayUtc}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % poolSize;
}

/** Today's stall listing, as threaded server page → client panel. */
export interface MerchantOffer {
  itemId: string;
  slug: string;
  packSlug: string;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
  rarity: string;
  imageUrl: string | null;
  price: number;
}

/** Discriminated purchase outcome — expected cases never throw (PR #128 rule). */
export type MerchantPurchaseOutcome =
  | { ok: true; card: RevealCard; balanceAfter: number }
  | { ok: false; reason: 'already_bought_today' }
  | { ok: false; reason: 'insufficient_coins'; price: number; balance: number }
  | { ok: false; reason: 'offer_changed' }
  | { ok: false; reason: 'no_offer' };
