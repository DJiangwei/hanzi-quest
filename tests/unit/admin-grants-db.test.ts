import { describe, expect, it, vi } from 'vitest';

// Mock @/db to avoid requiring DATABASE_URL at test-import time.
vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

// Mock @/db/schema — we only need table-name sentinels for spy assertions.
vi.mock('@/db/schema', () => {
  const fakeTable = (name: string) => {
    const t = { __name: name } as Record<string, unknown>;
    // Add column references used in sql`` expressions. Drizzle column refs are
    // objects; the tests don't inspect their content so plain objects suffice.
    t.childId = { __col: `${name}.child_id` };
    t.shards = { __col: `${name}.shards` };
    t.kind = { __col: `${name}.kind` };
    t.count = { __col: `${name}.count` };
    t.itemId = { __col: `${name}.item_id` };
    t.avatarItemId = { __col: `${name}.avatar_item_id` };
    t.unlockRef = { __col: `${name}.unlock_ref` };
    t.unlockVia = { __col: `${name}.unlock_via` };
    t.shopItemId = { __col: `${name}.shop_item_id` };
    t.slotId = { __col: `${name}.slot_id` };
    return t;
  };
  return {
    childShards: fakeTable('child_shards'),
    powerupInventory: fakeTable('powerup_inventory'),
    childCollections: fakeTable('child_collections'),
    shopPurchases: fakeTable('shop_purchases'),
    // shop.ts also imports these for applyShopItemOwnershipInTx
    shopItems: fakeTable('shop_items'),
    avatarItems: fakeTable('avatar_items'),
    childAvatarInventory: fakeTable('child_avatar_inventory'),
    childAvatarEquipped: fakeTable('child_avatar_equipped'),
    avatarSlots: fakeTable('avatar_slots'),
    coinBalances: fakeTable('coin_balances'),
  };
});

vi.mock('@/lib/db/coins', () => ({
  awardCoinsInTx: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper: build a minimal mock tx whose insert / update / delete calls are
// tracked. Use it to assert that the correct SQL operations are issued.
// ---------------------------------------------------------------------------
function makeTx() {
  const insertCalls: Array<{ table: string; values?: unknown }> = [];
  const updateCalls: Array<{ table: string }> = [];
  const deleteCalls: Array<{ table: string }> = [];
  const selectResponses: unknown[][] = [];
  let selectIdx = 0;

  function makeSelectChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    chain.from = ret;
    chain.where = ret;
    chain.limit = ret;
    chain.innerJoin = ret;
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(rows));
    return chain;
  }

  const tx = {
    insert: vi.fn((table: { __name?: string }) => {
      const tableName = table.__name ?? 'unknown';
      const call = { table: tableName, values: undefined as unknown };
      insertCalls.push(call);
      return {
        values: vi.fn((vals: unknown) => {
          call.values = vals;
          return {
            then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
            onConflictDoUpdate: vi.fn(() => ({
              then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
            })),
            onConflictDoNothing: vi.fn(() => ({
              then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
            })),
          };
        }),
      };
    }),
    update: vi.fn((table: { __name?: string }) => {
      const tableName = table.__name ?? 'unknown';
      updateCalls.push({ table: tableName });
      return {
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(undefined)),
        })),
      };
    }),
    delete: vi.fn((table: { __name?: string }) => {
      const tableName = table.__name ?? 'unknown';
      deleteCalls.push({ table: tableName });
      return {
        where: vi.fn(() => Promise.resolve(undefined)),
      };
    }),
    select: vi.fn(() => {
      const rows = selectResponses[selectIdx++] ?? [];
      return makeSelectChain(rows);
    }),
    // Tracks for inspection
    _insertCalls: insertCalls,
    _updateCalls: updateCalls,
    _deleteCalls: deleteCalls,
    _setSelectResponses: (responses: unknown[][]) => {
      selectResponses.splice(0, selectResponses.length, ...responses);
      selectIdx = 0;
    },
  };

  return tx;
}

import {
  grantShardsInTx,
  grantPowerupInTx,
  grantSpecificCardInTx,
  removeCardInTx,
  applyShopItemOwnershipInTx,
} from '@/lib/db/admin-grants';
import type { ShopItemRow } from '@/lib/db/shop';

/** Build a minimal ShopItemRow test fixture with sane defaults. */
function makeShopItem(overrides: Partial<ShopItemRow> & { kind: ShopItemRow['kind'] }): ShopItemRow {
  return {
    id: 'shop-1',
    slug: 'test-item',
    name: '测试',
    description: null,
    imageUrl: null,
    priceCoins: 300,
    availableFrom: null,
    availableTo: null,
    isActive: true,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// grantShardsInTx
// ---------------------------------------------------------------------------

describe('grantShardsInTx', () => {
  it('upserts +5 shards into child_shards', async () => {
    const tx = makeTx() as never;
    await grantShardsInTx(tx, 'child-1', 5);

    const ins = (tx as ReturnType<typeof makeTx>)._insertCalls;
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('child_shards');
    // The initial insert value for a fresh row should be max(0, 5) = 5
    expect((ins[0].values as Record<string, unknown>).shards).toBe(5);
  });

  it('clamps stored shards at 0 when delta is very negative', async () => {
    const tx = makeTx() as never;
    // delta=-100 → initial insert value = max(0, -100) = 0
    await grantShardsInTx(tx, 'child-1', -100);

    const ins = (tx as ReturnType<typeof makeTx>)._insertCalls;
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('child_shards');
    expect((ins[0].values as Record<string, unknown>).shards).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// grantPowerupInTx
// ---------------------------------------------------------------------------

describe('grantPowerupInTx', () => {
  it('upserts +3 of hint into powerup_inventory', async () => {
    const tx = makeTx() as never;
    await grantPowerupInTx(tx, 'child-1', 'hint', 3);

    const ins = (tx as ReturnType<typeof makeTx>)._insertCalls;
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('powerup_inventory');
    const vals = ins[0].values as Record<string, unknown>;
    expect(vals.kind).toBe('hint');
    expect(vals.count).toBe(3); // max(0, 3)
  });

  it('clamps count at 0 when delta is very negative', async () => {
    const tx = makeTx() as never;
    await grantPowerupInTx(tx, 'child-1', 'skip', -999);

    const ins = (tx as ReturnType<typeof makeTx>)._insertCalls;
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('powerup_inventory');
    expect((ins[0].values as Record<string, unknown>).count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// grantSpecificCardInTx
// ---------------------------------------------------------------------------

describe('grantSpecificCardInTx', () => {
  it('inserts a child_collections row at count=1 for a new card', async () => {
    const tx = makeTx() as never;
    await grantSpecificCardInTx(tx, 'child-1', 'item-abc');

    const ins = (tx as ReturnType<typeof makeTx>)._insertCalls;
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('child_collections');
    const vals = ins[0].values as Record<string, unknown>;
    expect(vals.childId).toBe('child-1');
    expect(vals.itemId).toBe('item-abc');
    expect(vals.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// removeCardInTx
// ---------------------------------------------------------------------------

describe('removeCardInTx', () => {
  it('issues an update (decrement) and a delete (purge-at-0) on child_collections', async () => {
    const tx = makeTx() as never;
    await removeCardInTx(tx, 'child-1', 'item-abc');

    const upd = (tx as ReturnType<typeof makeTx>)._updateCalls;
    const del = (tx as ReturnType<typeof makeTx>)._deleteCalls;
    expect(upd).toHaveLength(1);
    expect(upd[0].table).toBe('child_collections');
    expect(del).toHaveLength(1);
    expect(del[0].table).toBe('child_collections');
  });
});

// ---------------------------------------------------------------------------
// applyShopItemOwnershipInTx
// ---------------------------------------------------------------------------

describe('applyShopItemOwnershipInTx', () => {
  it('returns { newlyOwned: false } for an already-owned generic item (no insert)', async () => {
    const tx = makeTx();
    // Simulate: shop_purchases row already exists for this child + item
    tx._setSelectResponses([
      [{ id: 'existing-purchase' }], // existing shop_purchases row → already owned
    ]);

    const shopItem = makeShopItem({ id: 'shop-1', slug: 'pet-parrot', kind: 'pet' });

    const result = await applyShopItemOwnershipInTx(tx as never, 'child-1', shopItem);

    expect(result.newlyOwned).toBe(false);
    expect((tx as ReturnType<typeof makeTx>)._insertCalls).toHaveLength(0);
  });

  it('inserts shop_purchases with coinsSpent=0 for a not-yet-owned generic item', async () => {
    const tx = makeTx();
    // Simulate: no existing shop_purchases row
    tx._setSelectResponses([
      [], // no existing row → not owned
    ]);

    const shopItem = makeShopItem({ id: 'shop-1', slug: 'pet-parrot', kind: 'pet' });

    const result = await applyShopItemOwnershipInTx(tx as never, 'child-1', shopItem);

    expect(result.newlyOwned).toBe(true);
    const ins = (tx as ReturnType<typeof makeTx>)._insertCalls;
    expect(ins).toHaveLength(1);
    expect(ins[0].table).toBe('shop_purchases');
    expect((ins[0].values as Record<string, unknown>).coinsSpent).toBe(0);
  });

  it('returns { newlyOwned: false } for an already-owned avatar item (no insert)', async () => {
    const tx = makeTx();
    // For avatar: select 1=avatar_items (linked item), select 2=childAvatarInventory (already owned)
    tx._setSelectResponses([
      [{ id: 'avatar-item-1', slotId: 'hat', unlockRef: 'avatar-hat-tricorn', unlockVia: 'shop' }],
      [{ childId: 'child-1', avatarItemId: 'avatar-item-1' }], // already owned
    ]);

    const shopItem = makeShopItem({ id: 'shop-2', slug: 'avatar-hat-tricorn', kind: 'avatar', priceCoins: 120 });

    const result = await applyShopItemOwnershipInTx(tx as never, 'child-1', shopItem);

    expect(result.newlyOwned).toBe(false);
    expect(result.avatarItemId).toBe('avatar-item-1');
    expect((tx as ReturnType<typeof makeTx>)._insertCalls).toHaveLength(0);
  });
});
