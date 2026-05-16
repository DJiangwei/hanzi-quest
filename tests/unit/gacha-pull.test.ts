import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const items = [
    { id: 'item-rat',    packId: 'pack-1', slug: 'rat',    nameZh: '鼠', nameEn: 'Rat',    rarity: 'common', dropWeight: 1, imageUrl: null, loreZh: null, loreEn: null },
    { id: 'item-ox',     packId: 'pack-1', slug: 'ox',     nameZh: '牛', nameEn: 'Ox',     rarity: 'common', dropWeight: 1, imageUrl: null, loreZh: null, loreEn: null },
    { id: 'item-tiger',  packId: 'pack-1', slug: 'tiger',  nameZh: '虎', nameEn: 'Tiger',  rarity: 'common', dropWeight: 1, imageUrl: null, loreZh: null, loreEn: null },
  ];
  return { items, existingOwned: new Set<string>(), balanceRow: { balance: 1000 }, shardCount: 0 };
});

vi.mock('@/db', () => {
  const makeChain = (resolveTo: unknown) => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    chain.from = ret; chain.where = ret; chain.limit = ret; chain.orderBy = ret; chain.innerJoin = ret;
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(resolveTo));
    return chain;
  };

  const tx = {
    select: vi.fn().mockImplementation(() => {
      // Distinguish queries by call order — first balance, then items, then dupe check, then balance again.
      const callIdx = (tx.select as ReturnType<typeof vi.fn>).mock.calls.length;
      if (callIdx === 1) return makeChain([mocks.balanceRow]);
      if (callIdx === 2) return makeChain(mocks.items);
      if (callIdx === 3) {
        // dupe check
        const owned = Array.from(mocks.existingOwned).map((id) => ({ itemId: id }));
        return makeChain(owned.length > 0 ? owned : []);
      }
      return makeChain([{ balance: mocks.balanceRow.balance }]);
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ shards: ++mocks.shardCount }]),
        }),
        returning: vi.fn().mockResolvedValue([{ shards: 1 }]),
        then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return {
    db: { transaction: vi.fn(async (fn) => fn(tx)) },
  };
});

import { InsufficientCoinsError, pull } from '@/lib/db/gacha';

describe('pull (free)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.existingOwned.clear();
    mocks.balanceRow.balance = 1000;
    mocks.shardCount = 0;
  });

  afterEach(() => vi.clearAllMocks());

  it('picks an item via weighted random and inserts a new collection row', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0001);
    const result = await pull('child-1', 'pack-1', { isFree: true, costCoins: 0 });
    expect(result.wasDuplicate).toBe(false);
    expect(result.item.slug).toBe('rat');
    expect(result.shardsAfter).toBeNull();
  });

  it('treats already-owned item as duplicate and increments shard', async () => {
    mocks.existingOwned.add('item-rat');
    vi.spyOn(Math, 'random').mockReturnValue(0.0001);
    const result = await pull('child-1', 'pack-1', { isFree: true, costCoins: 0 });
    expect(result.wasDuplicate).toBe(true);
    expect(result.shardsAfter).toBe(1);
  });
});

describe('pull (paid)', () => {
  it('throws InsufficientCoinsError when balance < cost', async () => {
    mocks.balanceRow.balance = 100;
    await expect(
      pull('child-1', 'pack-1', { isFree: false, costCoins: 500 }),
    ).rejects.toThrow(InsufficientCoinsError);
  });
});
