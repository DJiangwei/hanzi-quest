import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('@/db', () => ({ db: dbMock }));

import {
  getSectionStatsForChild,
  countPracticeClearedForChild,
} from '@/lib/db/play';

function makeChain(rows: unknown[]) {
  // The impl does: db.select({...}).from(...).leftJoin(...).leftJoin(...).where(...).groupBy(...)
  // Final awaited value is the rows array.
  const resolvedRows = rows;

  const groupBy = vi.fn().mockResolvedValue(resolvedRows);

  const where = vi.fn().mockReturnValue({ groupBy });

  const leftJoin2 = vi.fn().mockReturnValue({ where });

  const leftJoin1 = vi.fn().mockReturnValue({ leftJoin: leftJoin2, where });

  const from = vi.fn().mockReturnValue({ leftJoin: leftJoin1, where });

  return { from };
}

beforeEach(() => { dbMock.select.mockReset(); });

describe('getSectionStatsForChild', () => {
  it('groups by section (derived from segment) and counts cleared (maxScore >= 100)', async () => {
    const rows = [
      { id: 'l1', segment: 'review',  maxScore: 100 },
      { id: 'l2', segment: 'review',  maxScore: 80 },     // not cleared
      { id: 'l3', segment: 'sound',   maxScore: 100 },
      { id: 'l4', segment: 'sight',   maxScore: null },   // never attempted
      { id: 'l5', segment: 'meaning', maxScore: 100 },
      { id: 'l6', segment: 'boss',    maxScore: null },
    ];
    dbMock.select.mockReturnValueOnce(makeChain(rows));
    const stats = await getSectionStatsForChild('c1', 'w1');
    expect(stats.review).toEqual({ done: 1, total: 2 });
    expect(stats.practice).toEqual({ done: 2, total: 3 });
    expect(stats.boss).toEqual({ done: 0, total: 1 });
  });

  it('returns all-zero stats when no levels exist', async () => {
    dbMock.select.mockReturnValueOnce(makeChain([]));
    const stats = await getSectionStatsForChild('c1', 'w1');
    expect(stats.review).toEqual({ done: 0, total: 0 });
    expect(stats.practice).toEqual({ done: 0, total: 0 });
    expect(stats.boss).toEqual({ done: 0, total: 0 });
  });
});

describe('countPracticeClearedForChild', () => {
  it('returns practice.done count from getSectionStatsForChild', async () => {
    const rows = [
      { id: 'l1', segment: 'sound', maxScore: 100 },
      { id: 'l2', segment: 'sound', maxScore: 100 },
      { id: 'l3', segment: 'sight', maxScore: 50 },
      { id: 'l4', segment: 'meaning', maxScore: 100 },
    ];
    dbMock.select.mockReturnValueOnce(makeChain(rows));
    const count = await countPracticeClearedForChild('c1', 'w1');
    expect(count).toBe(3);
  });
});
