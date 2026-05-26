import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  // select chain: db.select().from().where().orderBy()
  const selectOrderBy = vi.fn();
  const selectWhere = vi.fn().mockReturnValue({ orderBy: selectOrderBy });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  return { select, selectFrom, selectWhere, selectOrderBy };
});

vi.mock('@/db', () => ({
  db: {
    select: mocks.select,
  },
}));

import {
  getActivityForRange,
  bucketByDate,
} from '@/lib/db/activity';

beforeEach(() => {
  mocks.selectOrderBy.mockReset();
  mocks.select.mockClear();
  mocks.selectFrom.mockClear();
  mocks.selectWhere.mockClear();
  // Re-wire chains after clear
  mocks.selectOrderBy.mockResolvedValue([]);
  mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
  mocks.selectWhere.mockReturnValue({ orderBy: mocks.selectOrderBy });
  mocks.select.mockReturnValue({ from: mocks.selectFrom });
});

describe('bucketByDate', () => {
  it('groups transactions by UTC date', () => {
    const txs = [
      { date: '2026-05-01', reason: 'scene_complete', delta: 50 },
      { date: '2026-05-01', reason: 'daily_login', delta: 20 },
      { date: '2026-05-02', reason: 'streak_freeze', delta: 0 },
    ] as const;
    const days = bucketByDate(txs, '2026-05-01', '2026-05-03');
    expect(days).toHaveLength(3);
    expect(days[0].dateIso).toBe('2026-05-01');
    expect(days[0].played).toBe(true);
    expect(days[0].dailyLoginBonus).toBe(true);
    expect(days[0].coinsEarned).toBe(70);
    expect(days[1].freezeBurned).toBe(true);
    expect(days[1].played).toBe(false);
    expect(days[2].played).toBe(false); // no tx on 2026-05-03
  });
});

describe('getActivityForRange', () => {
  it('queries coin_transactions for range and buckets', async () => {
    mocks.selectOrderBy.mockResolvedValueOnce([
      { date: '2026-05-01', reason: 'scene_complete', delta: 50 },
    ]);
    const days = await getActivityForRange('child_1', '2026-05-01', '2026-05-01');
    expect(days).toHaveLength(1);
    expect(days[0].played).toBe(true);
    expect(days[0].coinsEarned).toBe(50);
  });
});
