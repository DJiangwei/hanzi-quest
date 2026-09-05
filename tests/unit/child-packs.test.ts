// Which maps the learning layer may draw from.
//
// The bug this exists to prevent: 温故, 航海日志 and 通缉令 all scoped their
// character pool to `child_profiles.current_curriculum_pack_id`. That column
// changes the moment a child finishes a map, so on 2026-09-05 — the day both
// children moved to 里海 — the Logbook fell from 96 characters to 8 and 温故
// went dark. Finishing a map erased the record of everything learned in it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: (...a: unknown[]) => mocks.select(...a) } }));

import { listEnteredPackIds, enteredPackCondition } from '@/lib/db/child-packs';

const dialect = new PgDialect();
const render = (frag: unknown) => dialect.sqlToQuery(frag as never);

function queueSelects(...rowSets: unknown[][]) {
  for (const rows of rowSets) {
    const chain: Record<string, unknown> = {};
    for (const m of ['from', 'innerJoin', 'where', 'limit', 'orderBy']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res);
    mocks.select.mockReturnValueOnce(chain);
  }
}

beforeEach(() => vi.clearAllMocks());

describe('listEnteredPackIds', () => {
  it('includes maps she has LEFT, not just the one she is on', async () => {
    // The whole point. Yinuo finished 加勒比海 and sailed to 里海; her 96
    // Caribbean characters must stay in scope.
    queueSelects([{ packId: 'caspian' }], [{ packId: 'caribbean' }, { packId: 'caspian' }]);
    const out = await listEnteredPackIds('c1');
    expect(new Set(out)).toEqual(new Set(['caribbean', 'caspian']));
  });

  it('includes the current map even with no progress in it yet', async () => {
    // 小板 switched to 里海 the day she beat the Caribbean overlord, with zero
    // progress rows there. Deriving scope from progress ALONE would hide the
    // map she is standing on.
    queueSelects([{ packId: 'caspian' }], [{ packId: 'caribbean' }]);
    expect(new Set(await listEnteredPackIds('c1'))).toEqual(
      new Set(['caribbean', 'caspian']),
    );
  });

  it('deduplicates rather than returning one id per progress row', async () => {
    queueSelects(
      [{ packId: 'p1' }],
      [{ packId: 'p1' }, { packId: 'p1' }, { packId: 'p1' }],
    );
    expect(await listEnteredPackIds('c1')).toEqual(['p1']);
  });

  it('returns nothing for a child with no pack and no progress', async () => {
    queueSelects([], []);
    expect(await listEnteredPackIds('c1')).toEqual([]);
  });

  it('reads with select, never selectDistinct', async () => {
    // A shared helper must be safe to drop into any module. `selectDistinct`
    // would oblige every suite that mocks `@/db` to grow another method just
    // to import a file that calls this — the logError lesson (PR #172), where
    // one new call site broke 14 unrelated suites at import time. The Set
    // already dedupes.
    expect(
      (await import('node:fs')).readFileSync('src/lib/db/child-packs.ts', 'utf8'),
      // The CALL, not the word — the module explains this choice in a comment.
    ).not.toMatch(/\.selectDistinct\(/);
  });
});

describe('enteredPackCondition', () => {
  it('matches any entered pack, plus weeks authored for this child', async () => {
    const q = render(enteredPackCondition('c1', ['p1', 'p2']));
    expect(q.sql).toContain('"child_id"');
    expect(q.sql).toContain('"curriculum_pack_id"');
    expect(q.params).toEqual(expect.arrayContaining(['c1', 'p1', 'p2']));
  });

  it('narrows to her own weeks when she has entered no pack', async () => {
    // An `inArray` over an empty list renders as false; spelling the case out
    // keeps the intent readable at the call sites.
    const q = render(enteredPackCondition('c1', []));
    expect(q.params).toEqual(['c1']);
    expect(q.sql).not.toContain('curriculum_pack_id');
  });
});
