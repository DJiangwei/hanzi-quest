/**
 * Shard-swap economy — pure, client-safe (no postgres). Shared by the server
 * (`swapShardsInTx`, which CHARGES the cost) and the client (`PackPageBody`,
 * which DISPLAYS it) so the shown cost and the charged cost can never drift.
 *
 * Design (2026-06-13, David): regular collection packs cost 3 shards to swap for
 * a card; the reward-only **limited** packs (festival + season) cost more, to
 * preserve their play-to-earn exclusivity + create FOMO — a missed festival /
 * season card can be recovered via shards, but only with a real grind, so the
 * cheap path stays "earn it in its window by practicing."
 */

/** Default shard cost to swap for one card (regular packs). */
export const SHARD_SWAP_COST = 3;

/** Elevated shard cost for the reward-only limited packs (festival + season). */
export const SHARD_SWAP_COST_EXCLUSIVE = 12;

/**
 * Reward-only LIMITED packs whose cards cost the elevated swap price. These are
 * exactly the `gacha_eligible = false` packs. **When you add a new reward-only
 * pack, add its slug here** (and to the `gacha_eligible=false` seed) or its cards
 * become cheaply swappable, defeating the FOMO.
 */
export const SHARD_SWAP_EXCLUSIVE_PACKS: ReadonlySet<string> = new Set([
  'festivals-v1',
  'season-summer-v1',
  'champions-v1',
  'key-vault-v1',
]);

/**
 * Packs whose cards can NEVER be bought with shards, at any price.
 *
 * These two are proof-of-clear: 钥匙宝库 is opened by collecting every key on a
 * map, 海域霸主 by beating that map's overlord. A card you can buy is not proof
 * of anything, so no shard price is the right one.
 *
 * Deliberately NARROWER than SHARD_SWAP_EXCLUSIVE_PACKS: 节日 and 赛季 are
 * *timed* exclusives rather than achievements. Missing a festival's window
 * should cost a real grind (12 shards) to recover, not be permanent.
 *
 * Every locked pack must also be gacha-ineligible — a card that cannot be
 * earned by grinding but can still drop from a chest would arrive by luck and
 * not by achievement, which is the same contradiction from the other side.
 */
export const SHARD_SWAP_LOCKED_PACKS: ReadonlySet<string> = new Set([
  'key-vault-v1',
  'champions-v1',
]);

/** False when this pack's cards can never be obtained with shards. */
export function isPackShardSwappable(packSlug: string): boolean {
  return !SHARD_SWAP_LOCKED_PACKS.has(packSlug);
}

/**
 * The shard cost to swap for a card in the given pack. Callers MUST check
 * `isPackShardSwappable` first — a locked pack has no meaningful cost, and this
 * returns the exclusive price for one rather than pretending it is free.
 */
export function shardSwapCostForPack(packSlug: string): number {
  return SHARD_SWAP_EXCLUSIVE_PACKS.has(packSlug)
    ? SHARD_SWAP_COST_EXCLUSIVE
    : SHARD_SWAP_COST;
}
