import { describe, expect, it, vi } from 'vitest';

// db is imported at module load (used only by getGlobalShards, not the tx
// helpers under test) — mock it so DATABASE_URL isn't required.
vi.mock('@/db', () => ({ db: { transaction: vi.fn(), select: vi.fn() } }));

import { convertDuplicateInTx, swapShardsInTx } from '@/lib/db/grants';

/**
 * Minimal chainable + thenable fake tx. Every builder method returns the same
 * object; awaiting it resolves the next queued result (in call order).
 */
function makeTx(queue: unknown[]) {
  let i = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  for (const m of [
    'select', 'from', 'where', 'for', 'set', 'update', 'insert',
    'values', 'onConflictDoUpdate', 'returning', 'groupBy', 'innerJoin',
  ]) {
    b[m] = () => b;
  }
  b.then = (resolve: (v: unknown) => void) => resolve(queue[i++] ?? []);
  return b;
}

describe('convertDuplicateInTx', () => {
  it('rejects when the child has no spare duplicate (count < 2)', async () => {
    const tx = makeTx([[{ count: 1 }]]);
    const r = await convertDuplicateInTx(tx, 'c1', 'item-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_duplicate');
  });

  it('decrements the ×N count and adds +1 shard when count >= 2', async () => {
    // queue: 1) select count → 2  2) update count  3) insert wallet → shards 5
    const tx = makeTx([[{ count: 2 }], [], [{ shards: 5 }]]);
    const r = await convertDuplicateInTx(tx, 'c1', 'item-1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.count).toBe(1);
      expect(r.shards).toBe(5);
    }
  });
});

describe('swapShardsInTx (universal wallet)', () => {
  it('returns item_not_found for an unknown item', async () => {
    const tx = makeTx([[]]); // item lookup → none
    const r = await swapShardsInTx(tx, 'c1', 'nope');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('item_not_found');
  });

  it('returns already_owned when the child already has the item', async () => {
    const tx = makeTx([[{ id: 'item-1' }], [{ itemId: 'item-1' }]]);
    const r = await swapShardsInTx(tx, 'c1', 'item-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already_owned');
  });

  it('returns insufficient_shards when the global wallet is below cost', async () => {
    const tx = makeTx([[{ id: 'item-1' }], [], [{ shards: 2 }]]);
    const r = await swapShardsInTx(tx, 'c1', 'item-1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('insufficient_shards');
  });

  it('spends 3 global shards and grants the item when affordable (regular pack)', async () => {
    // 1) item lookup 2) owned check (none) 3) wallet → 5 4) update wallet 5) insert collection
    const tx = makeTx([[{ id: 'item-1', packSlug: 'zodiac-v1' }], [], [{ shards: 5 }], [], []]);
    const r = await swapShardsInTx(tx, 'c1', 'item-1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.shardsRemaining).toBe(2); // 5 - 3
  });

  it('charges the elevated cost (12) for a season/festival limited card', async () => {
    const tx = makeTx([[{ id: 'sc1', packSlug: 'season-summer-v1' }], [], [{ shards: 15 }], [], []]);
    const r = await swapShardsInTx(tx, 'c1', 'sc1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.shardsRemaining).toBe(3); // 15 - 12
  });

  it('is insufficient at 11 shards for a limited card (cost 12)', async () => {
    const tx = makeTx([[{ id: 'fc1', packSlug: 'festivals-v1' }], [], [{ shards: 11 }]]);
    const r = await swapShardsInTx(tx, 'c1', 'fc1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('insufficient_shards');
  });
});

// ── Locked packs ────────────────────────────────────────────────────────────
// 钥匙宝库 and 海域霸主 are proof-of-clear — a card you can buy proves nothing.
// The UI hides the swap, but the action is a public RPC endpoint the client can
// call with any itemId, so the refusal has to be enforced here.
describe('swapShardsInTx — locked packs', () => {
  for (const packSlug of ['key-vault-v1', 'champions-v1']) {
    it(`refuses ${packSlug} before reading or debiting any shards`, async () => {
      // Only the item lookup is queued. If the guard fired late, the balance
      // read would consume an empty queue entry and the reason would differ.
      const tx = makeTx([[{ id: 'item-1', packSlug }]]);
      const r = await swapShardsInTx(tx, 'c1', 'item-1');
      expect(r).toEqual({ ok: false, reason: 'pack_locked' });
    });
  }

  it('still allows a festival card — timed exclusives keep their costly recovery path', async () => {
    const tx = makeTx([
      [{ id: 'item-1', packSlug: 'festivals-v1' }],
      [],                    // not already owned
      [{ shards: 99 }],      // plenty
    ]);
    const r = await swapShardsInTx(tx, 'c1', 'item-1');
    expect(r).toMatchObject({ ok: true });
  });
});
