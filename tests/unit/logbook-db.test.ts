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
    queueSelects([[{ packId: 'p1' }], [{ packId: 'p1' }], []]);
    await expect(getLogbookEntries('c1')).resolves.toEqual([]);
  });

  it('keeps a character with no telemetry at all, at zero evidence', async () => {
    // The Logbook must show every taught character. A character absent from
    // answer_events has to survive as an entry, not be dropped by a join —
    // 57 of production's 96 characters have only 1-2 scored answers.
    queueSelects([
      [{ packId: 'p1' }],
      // listEnteredPackIds' second read: the packs she has progress in.
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1, packId: 'p1' }],
      [{ weekId: 'w1', bossCleared: false }],
      // curriculum_packs: map names + created_at order for grouping.
      [{ id: 'p1', name: 'Pirate Class', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) }],
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
      // listEnteredPackIds' second read: the packs she has progress in.
      [{ packId: 'p1' }],
      [
        { weekId: 'w1', weekNumber: 1, packId: 'p1' },
        { weekId: 'w2', weekNumber: 2, packId: 'p1' },
        { weekId: 'w3', weekNumber: 3, packId: 'p1' },
      ],
      [], // no boss cleared → frontier is week 1
      // curriculum_packs: map names + created_at order for grouping.
      [{ id: 'p1', name: 'Pirate Class', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) }],
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
      // listEnteredPackIds' second read: the packs she has progress in.
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1, packId: 'p1' }],
      [{ weekId: 'w1', bossCleared: true }],
      // curriculum_packs: map names + created_at order for grouping.
      [{ id: 'p1', name: 'Pirate Class', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) }],
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
      // listEnteredPackIds' second read: the packs she has progress in.
      [{ packId: 'p1' }],
      [
        { weekId: 'w1', weekNumber: 1, packId: 'p1' },
        { weekId: 'w2', weekNumber: 2, packId: 'p1' },
      ],
      [{ weekId: 'w1', bossCleared: true }], // frontier → week 2, so both weeks unlock
      // curriculum_packs: map names + created_at order for grouping.
      [{ id: 'p1', name: 'Pirate Class', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) }],
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
      // listEnteredPackIds' second read: the packs she has progress in.
      [{ packId: 'p1' }],
      [{ weekId: 'w1', weekNumber: 1, packId: 'p1' }],
      [{ weekId: 'w1', bossCleared: true }],
      // curriculum_packs: map names + created_at order for grouping.
      [{ id: 'p1', name: 'Pirate Class', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) }],
      [{ characterId: 'ch1', weekId: 'w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one', position: 0 }],
      [],
      [],
      [],
    ]);
    await getLogbookEntries('c1');
    // Call index 4 is the stats select — see the row-set ordering pinned by
    // the tests above (pack, weeks, progress, charRows, stats, words, sentences).
    const statsFields = mocks.select.mock.calls[6][0] as { scored: unknown };
    const q = render(statsFields.scored);
    expect(q.sql).toMatch(/filter \(where/i);
    expect(q.sql).toMatch(/is not null/i);
  });

  it('computes the unlock frontier PER MAP — week numbers repeat across seas', async () => {
    // The trap in widening the pool, and it needs a fixture that can actually
    // tell the two implementations apart. A merged frontier is the MINIMUM
    // across maps, and a cleared week unlocks either way — so the difference
    // only shows on an UNCLEARED week that a per-map frontier reaches and a
    // merged one does not.
    //
    // 加勒比海: weeks 1-2 beaten, week 3 is her frontier island → unlocked.
    // 里海: nothing beaten, frontier is week 1.
    // Merged, the frontier becomes min(3, 1) = 1, and 加勒比海 week 3 — the
    // island she is standing on — silently disappears from her own logbook.
    mocks.bossWeeks.mockResolvedValue(new Set(['c-w1', 'c-w2', 'c-w3', 'k-w1']));
    queueSelects([
      [{ packId: 'caspian' }],
      [{ packId: 'caribbean' }, { packId: 'caspian' }],
      [
        { weekId: 'c-w1', weekNumber: 1, packId: 'caribbean' },
        { weekId: 'c-w2', weekNumber: 2, packId: 'caribbean' },
        { weekId: 'c-w3', weekNumber: 3, packId: 'caribbean' },
        { weekId: 'k-w1', weekNumber: 1, packId: 'caspian' },
      ],
      [
        { weekId: 'c-w1', bossCleared: true },
        { weekId: 'c-w2', bossCleared: true },
      ],
      [
        { id: 'caribbean', name: 'x', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) },
        { id: 'caspian', name: 'y', nameZh: '里海', nameEn: 'Caspian Sea', createdAt: new Date(1) },
      ],
      [
        { characterId: 'ch-1', weekId: 'c-w1', hanzi: '一', pinyin: ['yī'], meaningEn: 'one' },
        { characterId: 'ch-2', weekId: 'c-w2', hanzi: '二', pinyin: ['èr'], meaningEn: 'two' },
        { characterId: 'ch-3', weekId: 'c-w3', hanzi: '三', pinyin: ['sān'], meaningEn: 'three' },
        { characterId: 'ch-k', weekId: 'k-w1', hanzi: '鱼', pinyin: ['yú'], meaningEn: 'fish' },
      ],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    expect(out.map((e) => e.hanzi)).toEqual(['一', '二', '三', '鱼']);
    expect(out.map((e) => e.mapNameZh)).toEqual(['加勒比海', '加勒比海', '加勒比海', '里海']);
  });

  it('orders by map before week, so two seas do not interleave', async () => {
    mocks.bossWeeks.mockResolvedValue(new Set(['c-w9', 'k-w1']));
    queueSelects([
      [{ packId: 'caspian' }],
      [{ packId: 'caribbean' }, { packId: 'caspian' }],
      [
        { weekId: 'k-w1', weekNumber: 1, packId: 'caspian' },
        { weekId: 'c-w9', weekNumber: 9, packId: 'caribbean' },
      ],
      [{ weekId: 'c-w9', bossCleared: true }],
      [
        { id: 'caribbean', name: 'x', nameZh: '加勒比海', nameEn: 'Caribbean Sea', createdAt: new Date(0) },
        { id: 'caspian', name: 'y', nameZh: '里海', nameEn: 'Caspian Sea', createdAt: new Date(1) },
      ],
      [
        { characterId: 'ch-k', weekId: 'k-w1', hanzi: '鱼', pinyin: ['yú'], meaningEn: 'fish' },
        { characterId: 'ch-c', weekId: 'c-w9', hanzi: '海', pinyin: ['hǎi'], meaningEn: 'sea' },
      ],
      [],
      [],
      [],
    ]);
    const out = await getLogbookEntries('c1');
    // Caribbean (created first) before Caspian, even though its week number is
    // higher. Sorting on weekNumber alone would put 里海 week 1 first.
    expect(out.map((e) => e.hanzi)).toEqual(['海', '鱼']);
  });
});
