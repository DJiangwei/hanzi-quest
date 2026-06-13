import { describe, expect, it } from 'vitest';
import {
  shardSwapCostForPack,
  SHARD_SWAP_COST,
  SHARD_SWAP_COST_EXCLUSIVE,
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
