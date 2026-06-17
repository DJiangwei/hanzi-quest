import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  assertAdmin: vi.fn(),
  awardCoins: vi.fn().mockResolvedValue(undefined),
  awardXp: vi.fn().mockResolvedValue({ totalXp: 100, level: 1, leveledUp: false }),
  getCoinBalance: vi.fn().mockResolvedValue({ balance: 500 }),
  getChildXp: vi.fn().mockResolvedValue({ totalXp: 100, level: 1 }),
  getGlobalShards: vi.fn().mockResolvedValue(5),
  grantShardsInTx: vi.fn().mockResolvedValue(undefined),
  grantPowerupInTx: vi.fn().mockResolvedValue(undefined),
  grantSpecificCardInTx: vi.fn().mockResolvedValue(undefined),
  removeCardInTx: vi.fn().mockResolvedValue(undefined),
  applyShopItemOwnershipInTx: vi.fn().mockResolvedValue({ newlyOwned: true }),
  revokeShopItemInTx: vi.fn().mockResolvedValue(undefined),
  grantGiftPackInTx: vi.fn(),
  revalidatePath: vi.fn(),
  dbTransaction: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
  dbCount: vi.fn().mockResolvedValue([{ count: 42 }]),
}));

vi.mock('@/lib/auth/guards', () => ({
  assertAdmin: mocks.assertAdmin,
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = 'Forbidden') { super(message); this.name = 'ForbiddenError'; }
  },
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') { super(message); this.name = 'UnauthorizedError'; }
  },
}));

vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
  getCoinBalance: mocks.getCoinBalance,
}));

vi.mock('@/lib/db/xp', () => ({
  awardXp: mocks.awardXp,
  getChildXp: mocks.getChildXp,
}));

vi.mock('@/lib/db/grants', () => ({
  grantGiftPackInTx: mocks.grantGiftPackInTx,
  getGlobalShards: mocks.getGlobalShards,
}));

vi.mock('@/lib/db/admin-grants', () => ({
  grantShardsInTx: mocks.grantShardsInTx,
  grantPowerupInTx: mocks.grantPowerupInTx,
  grantSpecificCardInTx: mocks.grantSpecificCardInTx,
  removeCardInTx: mocks.removeCardInTx,
  applyShopItemOwnershipInTx: mocks.applyShopItemOwnershipInTx,
  revokeShopItemInTx: mocks.revokeShopItemInTx,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

// ---------------------------------------------------------------------------
// DB mock — controls which rows are returned from select / insert / update
// ---------------------------------------------------------------------------
type TxFn = (tx: unknown) => Promise<unknown>;

/**
 * Builds a select-chain that resolves to `rows` when awaited or `.then`'d.
 */
function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = self;
  chain.where = self;
  chain.limit = self;
  chain.orderBy = self;
  chain.innerJoin = self;
  chain.then = (cb: (v: unknown[]) => unknown) => Promise.resolve(cb(rows));
  return chain;
}

/**
 * Builds a fake `tx` whose select responses are consumed in order from `selectQueue`.
 */
function makeTx(selectQueue: unknown[][] = []) {
  let idx = 0;
  return {
    select: vi.fn(() => makeSelectChain(selectQueue[idx++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
        onConflictDoUpdate: vi.fn(() => ({
          then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
          returning: vi.fn(() =>
            Promise.resolve([{ totalXp: 100 }]),
          ),
        })),
        onConflictDoNothing: vi.fn(() => ({
          then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
        })),
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(undefined)),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(undefined)),
    })),
  };
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
        onConflictDoUpdate: vi.fn(() => ({
          then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(undefined)),
      })),
    })),
    transaction: mocks.dbTransaction,
  },
}));

// Stub drizzle-orm helpers used in the action (count, desc, asc, etc.)
vi.mock('drizzle-orm', async (importActual) => {
  const actual = await importActual<typeof import('drizzle-orm')>();
  return {
    ...actual,
  };
});

// ---------------------------------------------------------------------------
// Schema mock — table sentinels so drizzle queries don't need a real DB
// ---------------------------------------------------------------------------
vi.mock('@/db/schema', () => {
  const fakeTable = (name: string) => ({ __name: name });
  return {
    adminGrants: fakeTable('admin_grants'),
    childCollections: fakeTable('child_collections'),
    childProfiles: fakeTable('child_profiles'),
    collectibleItems: fakeTable('collectible_items'),
    shopItems: fakeTable('shop_items'),
    users: fakeTable('users'),
  };
});

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------
import {
  listAllChildrenForAdminAction,
  getChildAdminSummaryAction,
  sendAdminGiftAction,
  undoAdminGiftAction,
} from '@/lib/actions/admin';
import { ForbiddenError } from '@/lib/auth/guards';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ADMIN_USER = { id: 'admin-user-1', role: 'admin', email: 'admin@test.com' };
const CHILD_ID = 'child-uuid-1';
const GRANT_ID = 'grant-uuid-1';

/** Configure the db.transaction mock to run the callback with a fake tx. */
function setupTransaction(selectQueue: unknown[][] = []) {
  const tx = makeTx(selectQueue);
  mocks.dbTransaction.mockImplementation(async (fn: TxFn) => fn(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertAdmin.mockResolvedValue(ADMIN_USER);
  mocks.grantGiftPackInTx.mockResolvedValue({ granted: true, cards: [] });
  mocks.applyShopItemOwnershipInTx.mockResolvedValue({ newlyOwned: true });
  setupTransaction();
});

// ---------------------------------------------------------------------------
// listAllChildrenForAdminAction
// ---------------------------------------------------------------------------
describe('listAllChildrenForAdminAction', () => {
  it('calls assertAdmin and returns child list', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([
        { id: CHILD_ID, displayName: '小明', gender: 'boy', parentEmail: 'parent@test.com' },
      ]) as never,
    );

    const result = await listAllChildrenForAdminAction();

    expect(mocks.assertAdmin).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CHILD_ID);
  });

  it('rejects when assertAdmin throws', async () => {
    mocks.assertAdmin.mockRejectedValue(new ForbiddenError('Admin role required'));
    await expect(listAllChildrenForAdminAction()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// getChildAdminSummaryAction
// ---------------------------------------------------------------------------
describe('getChildAdminSummaryAction', () => {
  it('calls assertAdmin and returns coin/xp/shard/count snapshot', async () => {
    const { db } = await import('@/db');
    // Mock the db.select for ownedCount (childCollections count query)
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ count: 42 }]) as never,
    );

    const result = await getChildAdminSummaryAction(CHILD_ID);

    expect(mocks.assertAdmin).toHaveBeenCalledOnce();
    expect(mocks.getCoinBalance).toHaveBeenCalledWith(CHILD_ID);
    expect(mocks.getChildXp).toHaveBeenCalledWith(CHILD_ID);
    expect(mocks.getGlobalShards).toHaveBeenCalledWith(CHILD_ID);
    expect(result.coins).toBe(500);
    expect(result.xp).toBe(100);
    expect(result.shards).toBe(5);
  });

  it('rejects when not admin', async () => {
    mocks.assertAdmin.mockRejectedValue(new ForbiddenError('Admin role required'));
    await expect(getChildAdminSummaryAction(CHILD_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// sendAdminGiftAction — non-admin rejection
// ---------------------------------------------------------------------------
describe('sendAdminGiftAction — access control', () => {
  it('rejects when assertAdmin throws ForbiddenError', async () => {
    mocks.assertAdmin.mockRejectedValue(new ForbiddenError('Admin role required'));
    await expect(
      sendAdminGiftAction(CHILD_ID, { coins: 500 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// sendAdminGiftAction — multi-grant bundle
// ---------------------------------------------------------------------------
describe('sendAdminGiftAction — multi-grant bundle', () => {
  it('calls awardCoins, awardXp, grantShardsInTx, giftPack and writes admin_grants row', async () => {
    mocks.grantGiftPackInTx.mockResolvedValue({
      granted: true,
      cards: [{ itemId: 'item-flag-cn', packId: 'pack-1', packSlug: 'flags-v1', slug: 'flag-cn', nameZh: '中国', nameEn: 'China', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 }],
    });
    const tx = setupTransaction([
      // shopItems query for shopItemIds (empty — not in this bundle)
    ]);

    const result = await sendAdminGiftAction(CHILD_ID, {
      coins: 500,
      xp: 100,
      shards: 2,
      giftPack: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');

    // Coins + XP called OUTSIDE the transaction (sequential).
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ childId: CHILD_ID, delta: 500, reason: 'admin_adjust' }),
    );
    expect(mocks.awardXp).toHaveBeenCalledWith(CHILD_ID, 100, 'admin_grant');

    // In-tx: shards granted.
    expect(mocks.grantShardsInTx).toHaveBeenCalledWith(tx, CHILD_ID, 2);

    // In-tx: gift pack called.
    expect(mocks.grantGiftPackInTx).toHaveBeenCalledWith(
      tx,
      CHILD_ID,
      expect.stringContaining('admin:'),
    );

    // Result records the concrete grants.
    expect(result.result.coins).toBe(500);
    expect(result.result.xp).toBe(100);
    expect(result.result.shards).toBe(2);
    expect(result.result.cardItemIds).toContain('item-flag-cn');

    // admin_grants insert called.
    expect(tx.insert).toHaveBeenCalled();

    // Revalidation.
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/play/${CHILD_ID}`);
  });
});

// ---------------------------------------------------------------------------
// sendAdminGiftAction — shopUnlockAll expansion
// ---------------------------------------------------------------------------
describe('sendAdminGiftAction — shopUnlockAll expansion', () => {
  it('expands decor category and records only newly-owned ids', async () => {
    const decorItem1 = { id: 'shop-decor-1', kind: 'decor', slug: 'decor-sailboat', name: '帆船', description: null, imageUrl: null, priceCoins: 200, availableFrom: null, availableTo: null, isActive: true, metadata: {}, createdAt: new Date() };
    const decorItem2 = { id: 'shop-decor-2', kind: 'decor', slug: 'decor-seagull', name: '海鸥', description: null, imageUrl: null, priceCoins: 300, availableFrom: null, availableTo: null, isActive: true, metadata: {}, createdAt: new Date() };

    // applyShopItemOwnershipInTx: first item newly owned, second already owned.
    mocks.applyShopItemOwnershipInTx
      .mockResolvedValueOnce({ newlyOwned: true })
      .mockResolvedValueOnce({ newlyOwned: false });

    // The tx select for shopItems (shopUnlockAll query) should return the two decor items.
    const tx = makeTx([
      [decorItem1, decorItem2], // shopItems where kind=decor
    ]);
    mocks.dbTransaction.mockImplementation(async (fn: TxFn) => fn(tx));

    const result = await sendAdminGiftAction(CHILD_ID, {
      shopUnlockAll: ['decor'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');

    // Both items processed; only the first (newly owned) recorded in result.
    expect(mocks.applyShopItemOwnershipInTx).toHaveBeenCalledTimes(2);
    expect(result.result.shopItemIds).toEqual(['shop-decor-1']);
    expect(result.result.shopItemIds).not.toContain('shop-decor-2');
  });
});

// ---------------------------------------------------------------------------
// undoAdminGiftAction — reversal + undoneAt
// ---------------------------------------------------------------------------
describe('undoAdminGiftAction', () => {
  const RECORDED_RESULT: import('@/lib/actions/admin').GiftResult = {
    coins: 500,
    xp: 100,
    shards: 2,
    powerups: { skip: 1 },
    cardItemIds: ['item-flag-cn', 'item-zodiac-rat'],
    shopItemIds: ['shop-decor-1'],
  };

  it('reverses all recorded grants and sets undoneAt', async () => {
    const grantRow = {
      id: GRANT_ID,
      adminUserId: ADMIN_USER.id,
      childId: CHILD_ID,
      bundle: {},
      result: RECORDED_RESULT,
      createdAt: new Date(),
      undoneAt: null,
    };

    const { db } = await import('@/db');
    // First db.select (find grant by id) returns the row.
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([grantRow]) as never);

    const tx = setupTransaction();

    const result = await undoAdminGiftAction(GRANT_ID);

    expect(result.ok).toBe(true);

    // Coins reversed (negative delta).
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ childId: CHILD_ID, delta: -500, reason: 'admin_adjust' }),
    );

    // XP reversed (will be no-op in impl but called with -100).
    expect(mocks.awardXp).toHaveBeenCalledWith(CHILD_ID, -100, 'admin_grant', `undo:${GRANT_ID}`);

    // In-tx: shards revoked.
    expect(mocks.grantShardsInTx).toHaveBeenCalledWith(tx, CHILD_ID, -2);

    // In-tx: powerup revoked.
    expect(mocks.grantPowerupInTx).toHaveBeenCalledWith(tx, CHILD_ID, 'skip', -1);

    // In-tx: cards removed.
    expect(mocks.removeCardInTx).toHaveBeenCalledWith(tx, CHILD_ID, 'item-flag-cn');
    expect(mocks.removeCardInTx).toHaveBeenCalledWith(tx, CHILD_ID, 'item-zodiac-rat');

    // In-tx: shop item revoked.
    expect(mocks.revokeShopItemInTx).toHaveBeenCalledWith(tx, CHILD_ID, 'shop-decor-1');

    // undoneAt update issued.
    expect(tx.update).toHaveBeenCalled();

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('returns not_undoable if undoneAt is already set', async () => {
    const alreadyUndoneRow = {
      id: GRANT_ID,
      adminUserId: ADMIN_USER.id,
      childId: CHILD_ID,
      bundle: {},
      result: RECORDED_RESULT,
      createdAt: new Date(),
      undoneAt: new Date(),
    };

    const { db } = await import('@/db');
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([alreadyUndoneRow]) as never);

    const result = await undoAdminGiftAction(GRANT_ID);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected not ok');
    expect(result.reason).toBe('not_undoable');

    // No coin/xp/shard reversals.
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('returns not_found if grant row does not exist', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await undoAdminGiftAction(GRANT_ID);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected not ok');
    expect(result.reason).toBe('not_found');
  });

  it('rejects when not admin', async () => {
    mocks.assertAdmin.mockRejectedValue(new ForbiddenError('Admin role required'));
    await expect(undoAdminGiftAction(GRANT_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
