// T2 通缉令 — db layer: generation idempotency, ticking, transactional claim.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const fakeTable = (name: string) => {
    const col = (c: string) => ({ __col: `${name}.${c}` });
    return {
      __name: name,
      id: col('id'),
      childId: col('child_id'),
      dayUtc: col('day_utc'),
      characterId: col('character_id'),
      required: col('required'),
      progress: col('progress'),
      claimedAt: col('claimed_at'),
      createdAt: col('created_at'),
      weekId: col('week_id'),
      hanzi: col('hanzi'),
      weekNumber: col('week_number'),
      status: col('status'),
      curriculumPackId: col('curriculum_pack_id'),
      currentCurriculumPackId: col('current_curriculum_pack_id'),
      correct: col('correct'),
      selfRating: col('self_rating'),
    };
  };
  return {
    fakeTable,
    awardCoinsInTx: vi.fn().mockResolvedValue(undefined),
    selectResults: [] as unknown[][],
    insertCalls: [] as string[],
    updateCalls: [] as string[],
  };
});

vi.mock('@/lib/db/coins', () => ({ awardCoinsInTx: mocks.awardCoinsInTx }));
vi.mock('@/db/schema/bounties', () => ({ bountyPosters: mocks.fakeTable('bounty_posters') }));
vi.mock('@/db/schema/answer-events', () => ({ answerEvents: mocks.fakeTable('answer_events') }));
vi.mock('@/db/schema/content', () => ({
  characters: mocks.fakeTable('characters'),
  weekCharacters: mocks.fakeTable('week_characters'),
  weeks: mocks.fakeTable('weeks'),
}));
vi.mock('@/db/schema/auth', () => ({ childProfiles: mocks.fakeTable('child_profiles') }));

vi.mock('@/db', () => {
  const makeChain = (resolveTo: unknown) => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    for (const m of ['from', 'where', 'innerJoin', 'orderBy', 'limit', 'groupBy', 'for'])
      chain[m] = ret;
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve(cb(resolveTo));
    return chain;
  };
  const nextSelect = () => makeChain(mocks.selectResults.shift() ?? []);
  const makeInsert = (table: { __name?: string }) => {
    mocks.insertCalls.push(table.__name ?? 'unknown');
    const done = {
      then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
      onConflictDoNothing: vi.fn().mockReturnValue({
        then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)),
      }),
    };
    return { values: vi.fn().mockReturnValue(done) };
  };
  const makeUpdate = (table: { __name?: string }) => {
    mocks.updateCalls.push(table.__name ?? 'unknown');
    const done = { then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(undefined)) };
    return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(done) }) };
  };
  const dbObj = {
    select: vi.fn(nextSelect),
    insert: vi.fn(makeInsert),
    update: vi.fn(makeUpdate),
    transaction: vi.fn(async (fn: (t: unknown) => unknown) =>
      fn({ select: vi.fn(nextSelect), insert: vi.fn(makeInsert), update: vi.fn(makeUpdate) }),
    ),
  };
  return { db: dbObj };
});

import {
  claimBountyInTx,
  generateDailyBounties,
  tickBountyProgress,
} from '@/lib/db/bounties';
import { db } from '@/db';

type Tx = Parameters<typeof claimBountyInTx>[0];
const tx = {} as Tx; // claim uses the routed mocks via db.transaction in tests below

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResults.length = 0;
  mocks.insertCalls.length = 0;
  mocks.updateCalls.length = 0;
});

describe('generateDailyBounties', () => {
  it("no-ops when today's posters already exist", async () => {
    mocks.selectResults.push([{ id: 'b1' }]);
    await generateDailyBounties('c1', '2026-07-18');
    expect(mocks.insertCalls).toEqual([]);
  });

  it('inserts ranked posters for unseen chars of later weeks', async () => {
    mocks.selectResults.push(
      [], // no existing posters
      [{ packId: 'pack1' }], // child pack (playableWeekIds: child row)
      [
        { weekId: 'w1', weekNumber: 1 },
        { weekId: 'w9', weekNumber: 9 },
      ], // playable weeks
      [
        { characterId: 'ch-old', weekId: 'w1', hanzi: '好' },
        { characterId: 'ch-new', weekId: 'w9', hanzi: '难' },
      ], // week chars
      [{ characterId: 'ch-old', total: 20, wrong: 0, dontKnow: 0 }], // stats (ch-new unseen)
      [], // cooldown
    );
    await generateDailyBounties('c1', '2026-07-18');
    expect(mocks.insertCalls).toEqual(['bounty_posters']);
  });

  it('inserts nothing when every char is mastered', async () => {
    mocks.selectResults.push(
      [],
      [{ packId: 'pack1' }],
      [{ weekId: 'w1', weekNumber: 1 }],
      [{ characterId: 'ch-old', weekId: 'w1', hanzi: '好' }],
      [{ characterId: 'ch-old', total: 20, wrong: 0, dontKnow: 0 }],
      [],
    );
    await generateDailyBounties('c1', '2026-07-18');
    expect(mocks.insertCalls).toEqual([]);
  });
});

describe('tickBountyProgress', () => {
  it('one capped update per unique char; empty input is a no-op', async () => {
    await tickBountyProgress('c1', '2026-07-18', ['a', 'a', 'b']);
    expect(mocks.updateCalls).toEqual(['bounty_posters', 'bounty_posters']);
    await tickBountyProgress('c1', '2026-07-18', []);
    expect(mocks.updateCalls).toHaveLength(2);
  });
});

describe('claimBountyInTx (via routed tx mock)', () => {
  const runClaim = (charId = 'ch1') =>
    db.transaction((t) => claimBountyInTx(t as Tx, 'c1', '2026-07-18', charId));

  it('claims a full poster: stamps + pays + reports remaining-open state', async () => {
    mocks.selectResults.push(
      [{ id: 'b1', progress: 2, required: 2, claimedAt: null }], // poster row
      [{ id: 'b2' }], // one still-open poster
    );
    const res = await runClaim();
    expect(res).toEqual({ ok: true, coins: 40, allClaimedToday: false });
    expect(mocks.updateCalls).toEqual(['bounty_posters']);
    expect(mocks.awardCoinsInTx).toHaveBeenCalledWith(expect.anything(), {
      childId: 'c1',
      delta: 40,
      reason: 'bounty_claim',
      refType: 'bounty_poster',
      refId: 'b1',
    });
  });

  it('the last open poster reports allClaimedToday', async () => {
    mocks.selectResults.push(
      [{ id: 'b3', progress: 2, required: 2, claimedAt: null }],
      [], // none open after this claim
    );
    const res = await runClaim();
    expect(res).toEqual({ ok: true, coins: 40, allClaimedToday: true });
  });

  it('rejects unknown / unfinished / already-claimed posters without paying', async () => {
    mocks.selectResults.push([]);
    expect(await runClaim()).toEqual({ ok: false, reason: 'not_found' });
    mocks.selectResults.push([{ id: 'b1', progress: 1, required: 2, claimedAt: null }]);
    expect(await runClaim()).toEqual({ ok: false, reason: 'not_ready' });
    mocks.selectResults.push([{ id: 'b1', progress: 2, required: 2, claimedAt: new Date() }]);
    expect(await runClaim()).toEqual({ ok: false, reason: 'already_claimed' });
    expect(mocks.awardCoinsInTx).not.toHaveBeenCalled();
  });
});

void tx;
