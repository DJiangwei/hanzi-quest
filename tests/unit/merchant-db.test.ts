// E2 旅行商人 — db layer: offer derivation + transactional buy.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const fakeTable = (name: string) => {
    // Non-empty column stubs so drizzle operators (eq/notInArray/asc) accept them.
    const col = (c: string) => ({ __col: `${name}.${c}` });
    return {
      __name: name,
      id: col('id'),
      itemId: col('item_id'),
      childId: col('child_id'),
      packId: col('pack_id'),
      slug: col('slug'),
      nameZh: col('name_zh'),
      nameEn: col('name_en'),
      loreZh: col('lore_zh'),
      loreEn: col('lore_en'),
      rarity: col('rarity'),
      imageUrl: col('image_url'),
      isActive: col('is_active'),
      gachaEligible: col('gacha_eligible'),
      source: col('source'),
      refId: col('ref_id'),
      count: col('count'),
      balance: col('balance'),
    };
  };
  return {
    fakeTable,
    awardCoinsInTx: vi.fn().mockResolvedValue(undefined),
    // Routed results for successive db/tx selects (each test sets these).
    selectResults: [] as unknown[][],
    insertCalls: [] as string[],
    insertBehavior: {} as Record<string, () => void>,
    balance: 5000,
  };
});

vi.mock('@/lib/db/coins', () => ({ awardCoinsInTx: mocks.awardCoinsInTx }));

vi.mock('@/db/schema/gacha', () => ({ cardGrantsLog: mocks.fakeTable('card_grants_log') }));
vi.mock('@/db/schema/collections', () => ({
  childCollections: mocks.fakeTable('child_collections'),
  collectibleItems: mocks.fakeTable('collectible_items'),
  collectionPacks: mocks.fakeTable('collection_packs'),
}));
vi.mock('@/db/schema', () => ({ coinBalances: mocks.fakeTable('coin_balances') }));

vi.mock('@/db', () => {
  const makeChain = (resolveTo: unknown) => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    for (const m of ['from', 'where', 'innerJoin', 'orderBy', 'limit', 'for']) chain[m] = ret;
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(resolveTo));
    return chain;
  };
  const nextSelect = () => makeChain(mocks.selectResults.shift() ?? []);
  const makeInsert = (table: { __name?: string }) => {
    const name = table.__name ?? 'unknown';
    mocks.insertCalls.push(name);
    const resolveOrThrow = () => {
      mocks.insertBehavior[name]?.();
      return Promise.resolve(undefined);
    };
    const awaited = {
      then: (cb: (v: unknown) => unknown, eb?: (e: unknown) => unknown) =>
        resolveOrThrow().then(cb, eb),
      onConflictDoUpdate: vi.fn().mockReturnValue({
        then: (cb: (v: unknown) => unknown, eb?: (e: unknown) => unknown) =>
          resolveOrThrow().then(cb, eb),
      }),
    };
    return { values: vi.fn().mockImplementation(() => {
      // Throw synchronously inside the promise chain when configured.
      try {
        mocks.insertBehavior[`${name}:sync`]?.();
      } catch (e) {
        return { then: (_: unknown, eb?: (e: unknown) => unknown) => (eb ? Promise.resolve(eb(e)) : Promise.reject(e)), onConflictDoUpdate: () => { throw e; } };
      }
      return awaited;
    }) };
  };
  const tx = { select: vi.fn(nextSelect), insert: vi.fn(makeInsert) };
  return {
    db: {
      select: vi.fn(nextSelect),
      insert: vi.fn(makeInsert),
      transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    },
  };
});

import { buyMerchantOffer, getMerchantOffer, hasBoughtMerchantToday } from '@/lib/db/merchant';
import { pickMerchantIndex } from '@/lib/merchant/offer';

const ITEM = {
  itemId: 'i1',
  slug: 'jp',
  packSlug: 'flags-v1',
  nameZh: '日本',
  nameEn: 'Japan',
  loreZh: null,
  loreEn: null,
  rarity: 'rare',
  imageUrl: 'https://blob/x.png',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResults.length = 0;
  mocks.insertCalls.length = 0;
  mocks.insertBehavior = {};
});

describe('getMerchantOffer', () => {
  it('returns null when the unowned pool is empty', async () => {
    mocks.selectResults.push([], []); // owned rows, empty pool
    expect(await getMerchantOffer('c1', '2026-07-18')).toBeNull();
  });

  it('prices the deterministic pick by rarity', async () => {
    mocks.selectResults.push([], [ITEM]); // no owned, 1-item pool
    const offer = await getMerchantOffer('c1', '2026-07-18');
    expect(offer).toMatchObject({ itemId: 'i1', price: 1200 });
    // Sanity: index the pure picker would use exists in the pool.
    expect(pickMerchantIndex('c1', '2026-07-18', 1)).toBe(0);
  });
});

describe('hasBoughtMerchantToday', () => {
  it('true only when a merchant log row exists for the day', async () => {
    mocks.selectResults.push([{ refId: '2026-07-18' }]);
    expect(await hasBoughtMerchantToday('c1', '2026-07-18')).toBe(true);
    mocks.selectResults.push([]);
    expect(await hasBoughtMerchantToday('c1', '2026-07-18')).toBe(false);
  });
});

describe('buyMerchantOffer', () => {
  const offer = { ...ITEM, price: 1200 };

  it('rejects a stale client card without touching the db', async () => {
    const res = await buyMerchantOffer('c1', '2026-07-18', offer, 'other-item');
    expect(res).toEqual({ ok: false, reason: 'offer_changed' });
    expect(mocks.insertCalls).toEqual([]);
  });

  it('success: day-guard row, coin debit, collection upsert, balanceAfter', async () => {
    mocks.selectResults.push([{ balance: 5000 }]); // balance check in tx
    const res = await buyMerchantOffer('c1', '2026-07-18', offer, 'i1');
    expect(res).toMatchObject({ ok: true, balanceAfter: 3800 });
    if (res.ok) expect(res.card).toMatchObject({ slug: 'jp', packSlug: 'flags-v1', isDupe: false });
    expect(mocks.insertCalls).toEqual(['card_grants_log', 'child_collections']);
    expect(mocks.awardCoinsInTx).toHaveBeenCalledWith(expect.anything(), {
      childId: 'c1',
      delta: -1200,
      reason: 'merchant_purchase',
      refType: 'merchant_offer',
      refId: '2026-07-18',
    });
  });

  it('insufficient coins: friendly outcome, no debit', async () => {
    mocks.selectResults.push([{ balance: 100 }]);
    const res = await buyMerchantOffer('c1', '2026-07-18', offer, 'i1');
    expect(res).toEqual({ ok: false, reason: 'insufficient_coins', price: 1200, balance: 100 });
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });

  it('second buy of the day: unique violation → already_bought_today', async () => {
    mocks.insertBehavior['card_grants_log'] = () => {
      const err = new Error('duplicate key') as Error & { code: string };
      err.code = '23505';
      throw err;
    };
    const res = await buyMerchantOffer('c1', '2026-07-18', offer, 'i1');
    expect(res).toEqual({ ok: false, reason: 'already_bought_today' });
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });
});
