// The read behind 温故. Assertions here render the real WHERE fragments through
// PgDialect rather than trusting a pre-shaped mock return — a stub that answers
// with rows proves nothing about the query that asked for them, which is how a
// Critical shipped in the piggy-bank work.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: (...a: unknown[]) => mocks.select(...a) } }));

import { PgDialect } from 'drizzle-orm/pg-core';
import { characterWord } from '@/db/schema/content';
import { getReviewCandidates, getReviewSessionData } from '@/lib/db/review';

const dialect = new PgDialect();
const render = (frag: unknown) => dialect.sqlToQuery(frag as never);

/**
 * Queue one resolved row-set per db.select(), capturing from()/where() args.
 *
 * The chain is THENABLE rather than resolving eagerly at `.where()` or
 * `.limit()`: real drizzle query builders stay chainable (any order, any
 * length) until actually awaited, and the module under test legitimately
 * calls `.where(...).limit(1)` on one query and `.where(...).groupBy(...)`
 * on another. A chain that resolves early at a fixed method breaks on any
 * shape that isn't its author's first guess — fix the helper to match real
 * query-builder semantics, not the module to match a narrower mock.
 */
function queueSelects(...rowSets: unknown[][]) {
  const calls: { from?: unknown; where?: unknown }[] = [];
  for (const rows of rowSets) {
    const rec: { from?: unknown; where?: unknown } = {};
    calls.push(rec);
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      from: vi.fn((t: unknown) => { rec.from = t; return chain; }),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      where: vi.fn((w: unknown) => { rec.where = w; return chain; }),
      then: (
        onFulfilled?: (v: unknown[]) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve(rows).then(onFulfilled, onRejected),
    });
    mocks.select.mockReturnValueOnce(chain);
  }
  return calls;
}

/** Row sets for the four selects every non-empty run shares, in order:
 *  child pack lookup, cleared weeks, characters-in-those-weeks, telemetry stats. */
const SHARED_ROWS: unknown[][] = [
  [{ packId: 'pack-1' }],
  [{ weekId: 'w1', weekNumber: 1 }],
  [{ characterId: 'c1', weekId: 'w1', hanzi: '你', meaningEn: 'you' }],
  [],
];

beforeEach(() => vi.clearAllMocks());

describe('getReviewCandidates', () => {
  it('restricts to weeks whose BOSS the child has cleared', async () => {
    // 温故 draws from what she has FINISHED. A week merely started is still
    // being taught; re-drilling it here would duplicate practice, not review.
    const calls = queueSelects([{ packId: 'pack-1' }], []);
    await getReviewCandidates('c1');
    const progressWhere = render(calls[1].where);
    expect(progressWhere.sql).toContain('"boss_cleared"');
    expect(progressWhere.params).toContain(true);
  });

  it('scopes every read to this child', async () => {
    const calls = queueSelects([{ packId: 'pack-1' }], []);
    await getReviewCandidates('c1');
    expect(render(calls[1].where).params).toContain('c1');
  });

  it('returns nothing when no week has been cleared', async () => {
    queueSelects([{ packId: 'pack-1' }], []);
    await expect(getReviewCandidates('c1')).resolves.toEqual([]);
  });
});

describe('getReviewSessionData', () => {
  it('returns nothing when no week has been cleared', async () => {
    queueSelects([{ packId: 'pack-1' }], []);
    await expect(getReviewSessionData('c1')).resolves.toEqual({
      candidates: [],
      pool: [],
    });
  });
});

describe('getReviewCandidates — scored aggregate SQL', () => {
  // F3: the reviewer reverted `scored` to `count(*)` — the exact defect this
  // branch exists to fix — and the whole suite still passed. Render the real
  // aggregate SQL through PgDialect and assert the `filter (where ... is not
  // null)` clause is actually there, rather than trusting a pre-shaped mock
  // return (a stub that answers with rows proves nothing about the query that
  // asked for them — this is the same technique the reviewer used to catch a
  // Critical in the piggy-bank work).
  it('scored counts only ANSWERED questions — filter(where correct is not null), never bare count(*)', async () => {
    queueSelects(...SHARED_ROWS);
    await getReviewCandidates('c1');
    // Call index 3 is the stats select — pack lookup, cleared weeks,
    // characters-in-those-weeks, then stats (SHARED_ROWS's own ordering).
    const statsFields = mocks.select.mock.calls[3][0] as { scored: unknown };
    const q = render(statsFields.scored);
    expect(q.sql).toMatch(/filter \(where/i);
    expect(q.sql).toMatch(/is not null/i);
  });
});

describe('getReviewCandidates vs getReviewSessionData — the pool query is skipped', () => {
  it('getReviewCandidates issues one fewer select, and the skipped one is the word read', async () => {
    queueSelects(...SHARED_ROWS);
    await getReviewCandidates('c1');
    const candidatesSelectCount = mocks.select.mock.calls.length;

    vi.clearAllMocks();

    const calls = queueSelects(
      ...SHARED_ROWS,
      [{ characterId: 'c1', wordId: 'wd1', text: '你好', imageUrl: null }],
    );
    await getReviewSessionData('c1');
    const sessionDataSelectCount = mocks.select.mock.calls.length;

    // Pin the actual counts, not just their relationship — a relative-only
    // assertion would stay green if both grew or shrank by the same amount.
    expect(candidatesSelectCount).toBe(4);
    expect(sessionDataSelectCount).toBe(5);
    expect(candidatesSelectCount).toBe(sessionDataSelectCount - 1);

    // The 5th select in getReviewSessionData — absent from getReviewCandidates
    // — is the characterWord ⋈ words read that builds the pool.
    expect(calls).toHaveLength(5);
    expect(calls[4].from).toBe(characterWord);
  });
});
