// V1 — the Logbook read. Mirrors tests/unit/review-db.test.ts's queued-select
// harness; see that file's header for why the chain must be thenable.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn(), bossWeeks: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: (...a: unknown[]) => mocks.select(...a) } }));
vi.mock('@/lib/db/weeks', async (orig) => ({
  ...(await orig<typeof import('@/lib/db/weeks')>()),
  listBossWeekIds: (...a: unknown[]) => mocks.bossWeeks(...a),
}));

import { getLogbookEntries } from '@/lib/db/logbook';

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
});
