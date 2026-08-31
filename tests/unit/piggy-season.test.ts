import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

const mocks = vi.hoisted(() => ({
  creditPiggyInTx: vi.fn(),
  isPiggyEnabledInTx: vi.fn(),
}));
// db/season.ts and coins.ts import @/db at module load; claimSeasonTierInTx
// receives its tx directly, so the client itself is never touched.
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/db/piggy', () => ({
  creditPiggyInTx: mocks.creditPiggyInTx,
  isPiggyEnabledInTx: mocks.isPiggyEnabledInTx,
}));

import { claimSeasonTierInTx } from '@/lib/db/season';

describe('summer voyage money tiers', () => {
  it('pays 50p / £1 / £1.50 at tiers 10, 20, 30 — £3 across the season', () => {
    const byTier = new Map(SUMMER_VOYAGE_TIERS.map((t) => [t.tier, t]));
    expect(byTier.get(10)?.bonusMoneyPence).toBe(50);
    expect(byTier.get(20)?.bonusMoneyPence).toBe(100);
    expect(byTier.get(30)?.bonusMoneyPence).toBe(150);

    const total = SUMMER_VOYAGE_TIERS.reduce(
      (s, t) => s + (t.bonusMoneyPence ?? 0),
      0,
    );
    expect(total).toBe(300);
  });

  it('keeps every tier its ORIGINAL reward — money is a bonus, not a swap', () => {
    const byTier = new Map(SUMMER_VOYAGE_TIERS.map((t) => [t.tier, t]));
    expect(byTier.get(10)?.reward).toEqual({
      type: 'card',
      cardSlug: 'season-tortoise',
    });
    expect(byTier.get(20)?.reward).toEqual({
      type: 'card',
      cardSlug: 'season-dolphin',
    });
  });

  it('leaves the other 27 tiers with no money', () => {
    const paying = SUMMER_VOYAGE_TIERS.filter((t) => t.bonusMoneyPence);
    expect(paying.map((t) => t.tier)).toEqual([10, 20, 30]);
  });
});

describe('claimSeasonTierInTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.creditPiggyInTx.mockResolvedValue({ credited: true });
    mocks.isPiggyEnabledInTx.mockResolvedValue(true);
  });

  /** The fake Drizzle tx from tests/unit/season-claim.test.ts. `selectResults`
   *  is a FIFO queue feeding each select(). */
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

  const moneyTier = {
    tier: 30,
    xpRequired: 9000,
    reward: { type: 'coins', amount: 100 } as const,
    bonusMoneyPence: 150,
  };
  const plainTier = {
    tier: 29,
    xpRequired: 8500,
    reward: { type: 'coins', amount: 100 } as const,
  };

  it('credits inside the SAME tx, so a rollback takes the money with it', async () => {
    const tx = makeTx([[]]); // claim-state read: nothing claimed yet
    await claimSeasonTierInTx(tx, 'c1', 's1', moneyTier);
    expect(mocks.creditPiggyInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        childId: 'c1',
        source: 'season_tier',
        refId: 's1:30',
        pence: 150,
      }),
    );
  });

  it('credits nothing for a tier with no money on it', async () => {
    await claimSeasonTierInTx(makeTx([[]]), 'c1', 's1', plainTier);
    expect(mocks.creditPiggyInTx).not.toHaveBeenCalled();
  });

  it('credits nothing when the tier was already claimed', async () => {
    const tx = makeTx([[{ tiersClaimed: [30] }]]);
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', moneyTier);
    expect(res).toEqual({ claimed: false, reveal: null });
    expect(mocks.creditPiggyInTx).not.toHaveBeenCalled();
  });

  it('credits nothing when the child\'s piggy bank is disabled — "off" must mean nothing accrues, not accrues-but-hidden', async () => {
    mocks.isPiggyEnabledInTx.mockResolvedValue(false);
    const tx = makeTx([[]]); // claim-state read: nothing claimed yet
    const res = await claimSeasonTierInTx(tx, 'c1', 's1', moneyTier);
    expect(res.claimed).toBe(true); // the reward (card/coins/etc) still grants
    expect(mocks.isPiggyEnabledInTx).toHaveBeenCalledWith(tx, 'c1');
    expect(mocks.creditPiggyInTx).not.toHaveBeenCalled();
  });

  it('credits when the flag read (inside the SAME tx) comes back enabled', async () => {
    mocks.isPiggyEnabledInTx.mockResolvedValue(true);
    const tx = makeTx([[]]);
    await claimSeasonTierInTx(tx, 'c1', 's1', moneyTier);
    expect(mocks.isPiggyEnabledInTx).toHaveBeenCalledWith(tx, 'c1');
    expect(mocks.creditPiggyInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ source: 'season_tier', pence: 150 }),
    );
  });
});
