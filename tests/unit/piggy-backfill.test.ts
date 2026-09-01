// The backfill reads four subsystems' tables. The load-bearing assertion is
// the bossless-week one: a week below BOSS_MIN_CHARS has no boss and can never
// be beaten, so it must never pay. Reading bossability from week content
// instead of the compiled boss row is what made week 10 unreachable in prod.
//
// Every query here decides a real-money payout, so a mock that hands back
// pre-shaped rows regardless of what WHERE/FROM the module built proves
// nothing about the query itself — a swapped `true`→`false`, a dropped
// child_id scope, or a `.from()` pointed at the wrong table would still pass
// a rows-in/rows-out test. Where a query's own filter/table is the claim,
// this file captures the real argument the module passed to `.from()` /
// `.where()` and renders the WHERE fragment through the real PgDialect (same
// technique as tests/unit/piggy-db.test.ts) instead of trusting the mock.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  cardGrantsLog,
  finalBossClears,
  piggyEntries,
  weekProgress,
} from '@/db/schema';

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
  pendingPastProgressCredits,
} from '@/lib/db/piggy-backfill';

/**
 * Renders a drizzle `sql`/condition fragment to its parameterized Postgres
 * text via the real PgDialect — the same technique tests/unit/piggy-db.test.ts
 * uses. A rows-in/rows-out mock never evaluates the SQL it's handed, so it
 * can't tell `bossCleared = true` apart from `bossCleared = false`, or a
 * missing `child_id` scope, or a swapped table. Rendering the actual fragment
 * can.
 */
function renderSql(fragment: unknown): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(fragment as SQL);
}

/** A select() chain that records what it was called with and resolves `rows`
 *  on `.where()`. Returned so callers can inspect `.from`/`.where` mock calls. */
function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    from: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows)),
  });
  return chain;
}

/** Queue one resolved row-set per db.select() call, in order. Returns the
 *  chains so a test can assert on the captured `.from()`/`.where()` args. */
function queueSelects(...rowSets: unknown[][]) {
  const chains = rowSets.map((rows) => makeSelectChain(rows));
  for (const chain of chains) {
    mocks.select.mockReturnValueOnce(chain);
  }
  return chains;
}

function fromArg(chain: ReturnType<typeof makeSelectChain>) {
  return (chain.from as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

function whereArg(chain: ReturnType<typeof makeSelectChain>) {
  return (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

const DAY = new Date('2026-07-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.creditPiggyInTx.mockResolvedValue({ credited: true });
});

describe('computePastProgressCredits', () => {
  it('pays £1 per beaten weekly boss, dated to last_played_at', async () => {
    const [progressChain, vaultChain, finalChain] = queueSelects(
      [{ weekId: 'w1', lastPlayedAt: DAY }],  // week_progress
      [],                                      // card_grants_log
      [],                                      // final_boss_clears
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));

    await expect(computePastProgressCredits('c1')).resolves.toEqual([
      { source: 'boss_clear', refId: 'w1', pence: 100, occurredAt: DAY },
    ]);

    // Pin the table AND the real WHERE fragment for each of the three
    // queries — a swapped `.from()`, a dropped child_id scope, or
    // bossCleared:true→false would still satisfy the hand-fed rows above,
    // but none of them survive rendering the actual fragment.
    expect(fromArg(progressChain)).toBe(weekProgress);
    const progressWhere = renderSql(whereArg(progressChain));
    expect(progressWhere.sql).toBe(
      '("week_progress"."child_id" = $1 and "week_progress"."boss_cleared" = $2)',
    );
    expect(progressWhere.params).toEqual(['c1', true]);

    expect(fromArg(vaultChain)).toBe(cardGrantsLog);
    expect(fromArg(finalChain)).toBe(finalBossClears);
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
    const [progressChain, vaultChain, finalChain] = queueSelects(
      [],
      [{ refId: 'pack-1', at: vaultAt }],
      [{ packId: 'pack-1', at: finalAt }],
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set());

    await expect(computePastProgressCredits('c1')).resolves.toEqual([
      { source: 'key_vault', refId: 'pack-1', pence: 100, occurredAt: vaultAt },
      { source: 'final_boss', refId: 'pack-1', pence: 300, occurredAt: finalAt },
    ]);

    // Same technique for the vault and final-boss queries: pin the table AND
    // the real predicate, so a `source = 'key_vault'` swapped for any other
    // string (or the query pointed at the wrong table) fails here even though
    // the hand-fed rows above would still make the value-level assertion pass.
    expect(fromArg(progressChain)).toBe(weekProgress);

    expect(fromArg(vaultChain)).toBe(cardGrantsLog);
    const vaultWhere = renderSql(whereArg(vaultChain));
    expect(vaultWhere.sql).toBe(
      '("card_grants_log"."child_id" = $1 and "card_grants_log"."source" = $2)',
    );
    expect(vaultWhere.params).toEqual(['c1', 'key_vault']);

    expect(fromArg(finalChain)).toBe(finalBossClears);
    const finalWhere = renderSql(whereArg(finalChain));
    expect(finalWhere.sql).toBe('"final_boss_clears"."child_id" = $1');
    expect(finalWhere.params).toEqual(['c1']);
  });

  it('never credits an already-claimed season tier', async () => {
    queueSelects([], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set());
    const out = await computePastProgressCredits('c1');
    expect(out.some((c) => c.source === 'season_tier')).toBe(false);
  });
});

describe('pendingPastProgressCredits', () => {
  it('filters out an already-credited (source, refId) pair but keeps an uncredited one', async () => {
    const vaultAt = new Date('2026-07-10T00:00:00Z');
    const finalAt = new Date('2026-07-20T00:00:00Z');
    const chains = queueSelects(
      [
        { weekId: 'w1', lastPlayedAt: DAY },
        { weekId: 'w2', lastPlayedAt: DAY },
      ], // week_progress
      [{ refId: 'pack-1', at: vaultAt }], // card_grants_log
      [{ packId: 'pack-1', at: finalAt }], // final_boss_clears
      // piggy_entries — w1's boss_clear AND pack-1's key_vault were already
      // backfilled once; w2's boss_clear and pack-1's final_boss were not.
      // Sharing the SAME refId ('pack-1') between two DIFFERENT sources is
      // deliberate here: it's what a key-vault claim and a final-boss clear
      // for the same map legitimately look like, and it's the only fixture
      // shape that can catch a dedupe key built from refId alone (dropping
      // `source`) — such a key would wrongly treat the credited
      // key_vault:pack-1 row as also covering the still-pending
      // final_boss:pack-1 entry.
      [
        { source: 'boss_clear', refId: 'w1' },
        { source: 'key_vault', refId: 'pack-1' },
      ],
    );
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1', 'w2']));

    const out = await pendingPastProgressCredits('c1');
    expect(out.map((c) => `${c.source}:${c.refId}`)).toEqual([
      'boss_clear:w2',
      'final_boss:pack-1',
    ]);

    // Pin the existing-entries query too: table, child_id scope, and the
    // source allowlist the dedupe reads through. A wrong key or a dropped
    // childId scope here would mis-state previewPastProgress — the number
    // the parent reads and agrees to before real money is credited — without
    // failing the value-level assertion above, since it uses c1 throughout.
    const existingChain = chains[3];
    expect(fromArg(existingChain)).toBe(piggyEntries);
    const existingWhere = renderSql(whereArg(existingChain));
    expect(existingWhere.sql).toBe(
      '("piggy_entries"."child_id" = $1 and "piggy_entries"."source" in ($2, $3, $4))',
    );
    expect(existingWhere.params).toEqual([
      'c1',
      'boss_clear',
      'key_vault',
      'final_boss',
    ]);
  });

  it('returns everything pending when nothing has been credited yet', async () => {
    queueSelects([{ weekId: 'w1', lastPlayedAt: DAY }], [], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set(['w1']));

    const out = await pendingPastProgressCredits('c1');
    expect(out.map((c) => c.refId)).toEqual(['w1']);
  });

  it('short-circuits before querying existing entries when nothing is pending', async () => {
    queueSelects([], [], []);
    mocks.listBossWeekIds.mockResolvedValue(new Set());

    const out = await pendingPastProgressCredits('c1');
    expect(out).toEqual([]);
    // Only the 3 computePastProgressCredits selects — no 4th call to query
    // piggy_entries when there is nothing to dedupe against.
    expect(mocks.select).toHaveBeenCalledTimes(3);
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
