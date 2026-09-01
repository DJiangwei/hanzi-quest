import { describe, expect, it } from 'vitest';
import {
  SHARD_SWAP_COST,
  SHARD_SWAP_COST_EXCLUSIVE,
  SHARD_SWAP_EXCLUSIVE_PACKS,
  SHARD_SWAP_LOCKED_PACKS,
  isPackShardSwappable,
  shardSwapCostForPack,
} from '@/lib/economy/shards';

describe('shardSwapCostForPack', () => {
  it('regular packs cost the default (3)', () => {
    for (const slug of [
      'zodiac-v1',
      'flags-v1',
      'sea-creatures-v1',
      'dinosaurs-v1',
      'solar-system-v1',
      'landmarks-v1',
    ]) {
      expect(shardSwapCostForPack(slug)).toBe(SHARD_SWAP_COST);
    }
    expect(SHARD_SWAP_COST).toBe(3);
  });

  it('festival + season limited packs cost the elevated price (12)', () => {
    expect(shardSwapCostForPack('festivals-v1')).toBe(SHARD_SWAP_COST_EXCLUSIVE);
    expect(shardSwapCostForPack('season-summer-v1')).toBe(SHARD_SWAP_COST_EXCLUSIVE);
    expect(SHARD_SWAP_COST_EXCLUSIVE).toBe(12);
  });
});

// ── Locked packs ────────────────────────────────────────────────────────────
// 钥匙宝库 and 海域霸主 are proof-of-clear: earned by collecting every key on a
// map, or by beating its overlord. Buying one with shards would empty the
// achievement of its meaning. 节日 and 赛季 stay swappable at the elevated
// price — those are *timed* exclusives, and a missed window deserves a costly
// recovery path rather than none at all.
describe('shard-swap locked packs', () => {
  it('locks the two proof-of-clear packs', () => {
    expect(isPackShardSwappable('key-vault-v1')).toBe(false);
    expect(isPackShardSwappable('champions-v1')).toBe(false);
  });

  it('leaves the timed exclusives swappable, at the elevated price', () => {
    expect(isPackShardSwappable('festivals-v1')).toBe(true);
    expect(isPackShardSwappable('season-summer-v1')).toBe(true);
    expect(shardSwapCostForPack('festivals-v1')).toBe(SHARD_SWAP_COST_EXCLUSIVE);
    expect(shardSwapCostForPack('season-summer-v1')).toBe(SHARD_SWAP_COST_EXCLUSIVE);
  });

  it('leaves every ordinary pack swappable at the regular price', () => {
    for (const slug of ['zodiac-v1', 'flags-v1', 'olympics-v1']) {
      expect(isPackShardSwappable(slug)).toBe(true);
      expect(shardSwapCostForPack(slug)).toBe(SHARD_SWAP_COST);
    }
  });

  it('every locked pack is also gacha-ineligible — locked means earned, both ways in', () => {
    // A pack that were locked from shards but still dropped from chests would
    // be a contradiction: the card would arrive by luck but not by grind.
    for (const slug of SHARD_SWAP_LOCKED_PACKS) {
      expect(SHARD_SWAP_EXCLUSIVE_PACKS.has(slug)).toBe(true);
    }
  });
});
