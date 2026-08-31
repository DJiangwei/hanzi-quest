// The backfill reads four subsystems' tables. The load-bearing assertion is
// the bossless-week one: a week below BOSS_MIN_CHARS has no boss and can never
// be beaten, so it must never pay. Reading bossability from week content
// instead of the compiled boss row is what made week 10 unreachable in prod.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  listBossWeekIds: vi.fn(),
  creditPiggyInTx: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...a: unknown[]) => mocks.select(...a),
    update: (...a: unknown[]) => mocks.update(...a),
    transaction: (...a: unknown[]) => mocks.transaction(...a),
  },
}));
vi.mock('@/lib/db/weeks', () => ({ listBossWeekIds: mocks.listBossWeekIds }));
vi.mock('@/lib/db/piggy', () => ({ creditPiggyInTx: mocks.creditPiggyInTx }));

import {
  computePastProgressCredits,
  enablePiggyBankWithBackfill,
} from '@/lib/db/piggy-backfill';

/** Queue one resolved row-set per db.select() call, in order. */
function queueSelects(...rowSets: unknown[][]) {
  for (const rows of rowSets) {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      from: vi.fn(() => chain),
      where: vi.fn(() => Promise.resolve(rows)),
    });
    mocks.select.mockReturnValueOnce(chain);
  }
}

const DAY = new Date('2026-07-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.creditPiggyInTx.mockResolvedValue({ credited: true });
});

describe('computePastProgressCredits', () => {
  it('pays £1 per beaten weekly boss, dated to last_played_at', async () => {
    queueSelects(
      [{ weekId: 'w1', lastPlayedAt: DAY }],  // week_progress
      [],                                      // card_grants_log
      [],                                      // final_boss_clears
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));

    await expect(computePastProgressCredits('c1')).resolves.toEqual([
      { source: 'boss_clear', refId: 'w1', pence: 100, occurredAt: DAY },
    ]);
  });

  it('pays NOTHING for a bossless week, even with boss_cleared set', async () => {
    queueSelects(
      [
        { weekId: 'w1', lastPlayedAt: DAY },
        { weekId: 'short', lastPlayedAt: DAY },
      ],
      [],
      [],
    );
    // 'short' is below BOSS_MIN_CHARS, so compile-week emitted no boss row.
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));

    const out = await computePastProgressCredits('c1');
    expect(out.map((c) => c.refId)).toEqual(['w1']);
  });

  it('pays £1 for a claimed vault and £3 for a final boss, exactly dated', async () => {
    const vaultAt = new Date('2026-07-10T00:00:00Z');
    const finalAt = new Date('2026-07-20T00:00:00Z');
    queueSelects(
      [],
      [{ refId: 'pack-1', at: vaultAt }],
      [{ packId: 'pack-1', at: finalAt }],
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set());

    await expect(computePastProgressCredits('c1')).resolves.toEqual([
      { source: 'key_vault', refId: 'pack-1', pence: 100, occurredAt: vaultAt },
      { source: 'final_boss', refId: 'pack-1', pence: 300, occurredAt: finalAt },
    ]);
  });

  it('never credits an already-claimed season tier', async () => {
    queueSelects([], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set());
    const out = await computePastProgressCredits('c1');
    expect(out.some((c) => c.source === 'season_tier')).toBe(false);
  });
});

describe('enablePiggyBankWithBackfill', () => {
  function stubTx() {
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const tx = { update: vi.fn(() => ({ set })) };
    mocks.transaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    return { tx, set };
  }

  it('sets the flag and credits every pending entry once', async () => {
    queueSelects([{ weekId: 'w1', lastPlayedAt: DAY }], [], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));
    const { set } = stubTx();

    await expect(enablePiggyBankWithBackfill('c1')).resolves.toEqual({
      creditedPence: 100,
      entries: 1,
    });
    expect(set).toHaveBeenCalledWith({ piggyBankEnabled: true });
  });

  it('is exactly-once — a second run credits nothing', async () => {
    queueSelects([{ weekId: 'w1', lastPlayedAt: DAY }], [], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));
    stubTx();
    // The unique index already holds this row, so the insert returns no rows.
    mocks.creditPiggyInTx.mockResolvedValue({ credited: false });

    await expect(enablePiggyBankWithBackfill('c1')).resolves.toEqual({
      creditedPence: 0,
      entries: 0,
    });
  });
});
