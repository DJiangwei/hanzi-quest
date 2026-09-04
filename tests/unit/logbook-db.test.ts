// V1 — the Logbook read. Mirrors tests/unit/review-db.test.ts's queued-select
// harness; see that file's header for why the chain must be thenable.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({ select: vi.fn(), bossWeeks: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: (...a: unknown[]) => mocks.select(...a) } }));
vi.mock('@/lib/db/weeks', async (orig) => ({
  ...(await orig<typeof import('@/lib/db/weeks')>()),
  listBossWeekIds: (...a: unknown[]) => mocks.bossWeeks(...a),
}));

import { getLogbookEntries } from '@/lib/db/logbook';

const dialect = new PgDialect();
const render = (frag: unknown) => dialect.sqlToQuery(frag as never);

/** Queue one resolved row-set per db.select(); every builder method chains. */
function queueSelects(rowSets: unknown[][]) {
  for (const rows of rowSets) {
    const chain: Record<string, unknown> = {};
    for (const m of ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'orderBy', 'limit']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res);
    mocks.select.mockReturnValueOnce(chain);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bossWeeks.mockResolvedValue(new Set(['w1']));
});

describe('getLogbookEntries', () => {
  it('returns nothing when the child has no playable weeks', async () => {
    queueSelects([[{ packId: 'p1' }], []]);
    await expect(getLogbookEntries('c1')).resolves.toEqual([]);
  });

  it('keeps a character with no telemetry at all, at zero evidence', async () => {
    // The Logbook must show every taught character. A character absent from
    // answer_events has to survive as an entry, not be dropped by a join —
    // 57 of production's 96 characters have only 1-2 scored answers.
    queueSelects([
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1 }],
      [{ weekId: 'w1', bossCleared: false }],
      [{ characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' }],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ hanzi: '一', scored: 0, wrong: 0, dontKnow: 0 });
  });

  it('excludes characters from weeks past the frontier', async () => {
    // T3 linear gating. Showing a locked week's characters would spoil unseen
    // content and inflate the denominator with characters she has never met.
    mocks.bossWeeks.mockResolvedValue(new Set(['w1', 'w2']));
    queueSelects([
      [{ packId: 'p1' }],
      [
        { weekId: 'w1', weekNumber: 1 },
        { weekId: 'w2', weekNumber: 2 },
        { weekId: 'w3', weekNumber: 3 },
      ],
      [], // no boss cleared → frontier is week 1
      [
        { characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' },
        { characterId: 'ch2', weekId: 'w2', hanzi: '二', pinyin: ['èr'], meaningEn: 'two' },
      ],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out.map((e) => e.hanzi)).toEqual(['一']);
  });

  it('splits scored answers from dont_know self-ratings', async () => {
    queueSelects([
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1 }],
      [{ weekId: 'w1', bossCleared: true }],
      [{ characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' }],
      [{ characterId: 'ch1', scored: 4, wrong: 1, dontKnow: 2 }],
      [{ characterId: 'ch1', text: '一起' }],
      [{ characterId: 'ch1', text: '我们一起走。' }],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out[0]).toMatchObject({
      scored: 4,
      wrong: 1,
      dontKnow: 2,
      firstWord: '一起',
      sentence: '我们一起走。',
    });
  });

  // F2: `week_characters` has no natural order and Postgres serves it via its
  // PK index (week_id, character_id) — uuid order, interleaving week 1 with
  // week 9, shifting whenever a row is rewritten. The Logbook is "a log of the
  // voyage" and must read in island order: weekNumber, then the week's own
  // `position`, then hanzi as a final tiebreak.
  it('orders entries by weekNumber then week_characters.position then hanzi — never by select return order', async () => {
    mocks.bossWeeks.mockResolvedValue(new Set(['w1', 'w2']));
    queueSelects([
      [{ packId: 'p1' }],
      [
        { weekId: 'w1', weekNumber: 1 },
        { weekId: 'w2', weekNumber: 2 },
      ],
      [{ weekId: 'w1', bossCleared: true }], // frontier → week 2, so both weeks unlock
      [
        // Deliberately supplied out of curriculum order.
        { characterId: 'ch-w2-p0', weekId: 'w2', hanzi: '三', pinyin: ['sān'], meaningEn: 'three', position: 0 },
        { characterId: 'ch-w1-p1', weekId: 'w1', hanzi: '乙', pinyin: ['yǐ'], meaningEn: 'second', position: 1 },
        { characterId: 'ch-w1-p0', weekId: 'w1', hanzi: '甲', pinyin: ['jiǎ'], meaningEn: 'first', position: 0 },
      ],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out.map((e) => e.characterId)).toEqual(['ch-w1-p0', 'ch-w1-p1', 'ch-w2-p0']);
  });

  // F3: the reviewer reverted `scored` to `count(*)` — the exact defect this
  // branch exists to fix — and the whole suite still passed. Render the real
  // aggregate SQL through PgDialect and assert the `filter (where ... is not
  // null)` clause is actually there, rather than trusting a pre-shaped mock
  // return (a stub that answers with rows proves nothing about the query that
  // asked for them).
  it('scored counts only ANSWERED questions — filter(where correct is not null), never bare count(*)', async () => {
    queueSelects([
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1 }],
      [{ weekId: 'w1', bossCleared: true }],
      [{ characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one', position: 0 }],
      [],
      [],
      [],
    ]);
    await getLogbookEntries('c1');
    // Call index 4 is the stats select — see the row-set ordering pinned by
    // the tests above (pack, weeks, progress, charRows, stats, words, sentences).
    const statsFields = mocks.select.mock.calls[4][0] as { scored: unknown };
    const q = render(statsFields.scored);
    expect(q.sql).toMatch(/filter \(where/i);
    expect(q.sql).toMatch(/is not null/i);
  });
});
