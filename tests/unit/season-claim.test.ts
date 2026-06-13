import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal @/db mock — claimSeasonTierInTx receives the tx directly, so db itself
// is unused here, but db/season.ts (and coins.ts) import it at module load.
vi.mock('@/db', () => ({ db: {} }));

import { claimSeasonTierInTx } from '@/lib/db/season';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

/** A fake Drizzle tx. `selectResults` is a FIFO queue feeding each select(). */
function makeTx(selectResults: unknown[][]) {
  const queue = [...selectResults];
  const tx = {
    insert: () => ({
      values: () =>
        Object.assign(Promise.resolve(), {
          onConflictDoNothing: () => Promise.resolve(),
          onConflictDoUpdate: () => Promise.resolve(),
        }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    select: () => {
      const result = queue.shift() ?? [];
      const node: Record<string, unknown> = {};
      node.from = () => node;
      node.innerJoin = () => node;
      node.where = () => node;
      node.limit = () => Promise.resolve(result);
      node.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
        Promise.resolve(result).then(res, rej);
      return node;
    },
  };
  return tx as never;
}

const tierByNum = (n: number) => SUMMER_VOYAGE_TIERS.find((t) => t.tier === n)!;

beforeEach(() => vi.clearAllMocks());

describe('claimSeasonTierInTx', () => {
  it('coins tier → claimed, no reveal', async () => {
    const tx = makeTx([[]]); // claim-state read: empty
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', tierByNum(1));
    expect(res).toEqual({ claimed: true, reveal: null });
  });

  it('powerup tier → claimed, no reveal', async () => {
    const tx = makeTx([[]]);
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', tierByNum(7));
    expect(res.claimed).toBe(true);
    expect(res.reveal).toBeNull();
  });

  it('shards tier → claimed, no reveal', async () => {
    const tx = makeTx([[]]);
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', tierByNum(8));
    expect(res.claimed).toBe(true);
    expect(res.reveal).toBeNull();
  });

  it('already-claimed tier → not claimed, no grant', async () => {
    const tx = makeTx([[{ tiersClaimed: [1] }]]);
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', tierByNum(1));
    expect(res).toEqual({ claimed: false, reveal: null });
  });

  it('card tier → claimed with a resolved reveal', async () => {
    const tx = makeTx([
      [], // claim-state: empty
      [
        {
          id: 'i10',
          slug: 'season-tortoise',
          nameZh: '海龟船长',
          nameEn: 'Captain Tortoise',
          loreZh: 'z',
          loreEn: 'e',
        },
      ], // card lookup
      [], // owned check: not owned
    ]);
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', tierByNum(10));
    expect(res.claimed).toBe(true);
    expect(res.reveal?.nameZh).toBe('海龟船长');
    expect(res.reveal?.packSlug).toBe('season-summer-v1');
    expect(res.reveal?.isDupe).toBe(false);
  });
});
