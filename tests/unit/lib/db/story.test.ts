import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbMock = vi.hoisted(() => {
  // Chainable mock — every method returns `chain` so callers can fluently
  // build queries. Terminal methods (where/limit/orderBy/returning) are
  // overridden per-test with mockResolvedValueOnce / mockReturnValueOnce.
  const chain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
    string,
    ReturnType<typeof vi.fn>
  >;
  const methods = [
    'select',
    'from',
    'innerJoin',
    'leftJoin',
    'where',
    'orderBy',
    'limit',
    'insert',
    'values',
    'onConflictDoNothing',
    'update',
    'set',
  ];
  for (const name of methods) chain[name] = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve([]));
  return { db: chain };
});

vi.mock('@/db', () => dbMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('upsertStoryChapter', () => {
  it('inserts a new chapter and returns the row', async () => {
    const row = {
      id: 'c1',
      childId: 'k1',
      weekId: 'w1',
      bodyZh: '小帆船',
      bodyEn: 'Tiny sail.',
      summaryForNext: '- A',
      tone: 'standard',
      bossScorePct: 80,
      readAt: null,
      createdAt: new Date(),
    };
    dbMock.db.returning.mockResolvedValueOnce([row]);
    const { upsertStoryChapter } = await import('@/lib/db/story');
    const result = await upsertStoryChapter({
      childId: 'k1',
      weekId: 'w1',
      bodyZh: '小帆船',
      bodyEn: 'Tiny sail.',
      summaryForNext: '- A',
      tone: 'standard',
      bossScorePct: 80,
    });
    expect(result).toEqual(row);
    expect(dbMock.db.onConflictDoNothing).toHaveBeenCalled();
  });

  it('returns the existing chapter on conflict', async () => {
    const existing = {
      id: 'c0',
      childId: 'k1',
      weekId: 'w1',
      bodyZh: 'old',
      bodyEn: 'old',
      summaryForNext: '- old',
      tone: 'standard',
      bossScorePct: 70,
      readAt: null,
      createdAt: new Date(),
    };
    dbMock.db.returning.mockResolvedValueOnce([]);
    dbMock.db.limit.mockResolvedValueOnce([existing]);
    const { upsertStoryChapter } = await import('@/lib/db/story');
    const result = await upsertStoryChapter({
      childId: 'k1',
      weekId: 'w1',
      bodyZh: 'new',
      bodyEn: 'new',
      summaryForNext: '- new',
      tone: 'triumphant',
      bossScorePct: 100,
    });
    expect(result).toEqual(existing);
  });
});

describe('getStoryChapterByWeek', () => {
  it('returns the chapter for a child+week', async () => {
    const row = { id: 'c1', childId: 'k1', weekId: 'w1' };
    dbMock.db.limit.mockResolvedValueOnce([row]);
    const { getStoryChapterByWeek } = await import('@/lib/db/story');
    const result = await getStoryChapterByWeek('k1', 'w1');
    expect(result).toEqual(row);
  });

  it('returns null when none', async () => {
    dbMock.db.limit.mockResolvedValueOnce([]);
    const { getStoryChapterByWeek } = await import('@/lib/db/story');
    const result = await getStoryChapterByWeek('k1', 'w1');
    expect(result).toBeNull();
  });
});

describe('listStoryChaptersForChild', () => {
  it('returns chapters ordered newest-first', async () => {
    const rows = [
      { id: 'c2', createdAt: new Date('2026-05-25') },
      { id: 'c1', createdAt: new Date('2026-05-18') },
    ];
    dbMock.db.orderBy.mockReturnValueOnce(Promise.resolve(rows));
    const { listStoryChaptersForChild } = await import('@/lib/db/story');
    const result = await listStoryChaptersForChild('k1');
    expect(result).toEqual(rows);
  });
});

describe('markChapterRead', () => {
  it('sets read_at for the matching chapter', async () => {
    dbMock.db.where.mockReturnValueOnce(Promise.resolve(undefined));
    const { markChapterRead } = await import('@/lib/db/story');
    await markChapterRead('c1', 'k1');
    expect(dbMock.db.update).toHaveBeenCalled();
    expect(dbMock.db.set).toHaveBeenCalledWith(
      expect.objectContaining({ readAt: expect.any(Date) }),
    );
  });

});

describe('getLatestUnreadChapter', () => {
  it('returns the most recent unread chapter for the child', async () => {
    const row = { id: 'c2', readAt: null, createdAt: new Date() };
    dbMock.db.limit.mockResolvedValueOnce([row]);
    const { getLatestUnreadChapter } = await import('@/lib/db/story');
    const result = await getLatestUnreadChapter('k1');
    expect(result).toEqual(row);
  });

  it('returns null when nothing unread', async () => {
    dbMock.db.limit.mockResolvedValueOnce([]);
    const { getLatestUnreadChapter } = await import('@/lib/db/story');
    expect(await getLatestUnreadChapter('k1')).toBeNull();
  });
});

describe('getLatestBossScoreForChildWeek', () => {
  it('returns the score from the latest boss scene_attempts row', async () => {
    dbMock.db.limit.mockResolvedValueOnce([{ score: 83 }]);
    const { getLatestBossScoreForChildWeek } = await import('@/lib/db/story');
    expect(await getLatestBossScoreForChildWeek('k1', 'w1')).toBe(83);
  });

  it('returns 0 when no boss attempt exists', async () => {
    dbMock.db.limit.mockResolvedValueOnce([]);
    const { getLatestBossScoreForChildWeek } = await import('@/lib/db/story');
    expect(await getLatestBossScoreForChildWeek('k1', 'w1')).toBe(0);
  });
});

describe('getCharactersAvailableForChildWeek', () => {
  it('returns chars from the current week + all earlier weeks in the same pack', async () => {
    dbMock.db.where.mockReturnValueOnce(
      Promise.resolve([{ text: '我' }, { text: '你' }, { text: '他' }]),
    );
    const { getCharactersAvailableForChildWeek } = await import(
      '@/lib/db/story'
    );
    const result = await getCharactersAvailableForChildWeek('w1');
    expect(result).toEqual(['我', '你', '他']);
  });
});
