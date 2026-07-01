import { describe, expect, it } from 'vitest';
import { AVATAR_THEMES, SHOP_FILTER_THEMES, isAvatarTheme } from '@/lib/avatar/themes';
import { rewardItems } from '@/lib/avatar/itemCatalog';
import { shardSwapCostForPack, SHARD_SWAP_COST_EXCLUSIVE } from '@/lib/economy/shards';

describe('champion theme + cosmetic', () => {
  it("'champion' is a theme but NOT a shop chip", () => {
    expect(isAvatarTheme('champion')).toBe(true);
    expect(SHOP_FILTER_THEMES).not.toContain('champion');
    expect(AVATAR_THEMES).toContain('champion');
  });
  it('the caribbean crown is a reward-only champion item', () => {
    const crown = rewardItems().find((i) => i.unlockRef === 'champion-caribbean');
    expect(crown).toBeTruthy();
    expect(crown!.theme).toBe('champion');
    expect(crown!.rewardOnly).toBe(true);
  });
  it('champions-v1 swap is shard-exclusive', () => {
    expect(shardSwapCostForPack('champions-v1')).toBe(SHARD_SWAP_COST_EXCLUSIVE);
  });
});
