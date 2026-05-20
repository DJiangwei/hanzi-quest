import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  txAwardCoins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db', () => ({
  db: {
    select: () => mocks.selectFn(),
    // awardCoins() uses db.transaction → fn(tx). We intercept by replacing
    // awardCoins itself in tests via the @/lib/db/coins mock below.
    transaction: vi.fn(async (fn) => fn({
      insert: vi.fn(() => ({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      })),
    })),
  },
}));

function mockNoExistingAward() {
  mocks.selectFn.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [],
      }),
    }),
  });
}

function mockExistingAward() {
  mocks.selectFn.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: 'existing-tx' }],
      }),
    }),
  });
}

beforeEach(() => {
  mocks.selectFn.mockReset();
});

describe('awardDailyLoginIfDue', () => {
  it('awards +20 on the first call of the day', async () => {
    mockNoExistingAward();
    const { awardDailyLoginIfDue, DAILY_LOGIN_AWARD } = await import(
      '@/lib/db/coins'
    );
    const result = await awardDailyLoginIfDue('c1', '2026-05-19');
    expect(result).toEqual({ awarded: true, delta: DAILY_LOGIN_AWARD });
  });

  it('is a no-op when a transaction already exists for today', async () => {
    mockExistingAward();
    const { awardDailyLoginIfDue } = await import('@/lib/db/coins');
    const result = await awardDailyLoginIfDue('c1', '2026-05-19');
    expect(result).toEqual({ awarded: false, delta: 0 });
  });
});

describe('awardStreakMilestoneIfDue', () => {
  it('skips non-multiples of 7', async () => {
    mockNoExistingAward();
    const { awardStreakMilestoneIfDue } = await import('@/lib/db/coins');
    for (const days of [1, 2, 3, 4, 5, 6, 8, 13, 15]) {
      const r = await awardStreakMilestoneIfDue('c1', days);
      expect(r.awarded, `streak=${days}`).toBe(false);
      expect(r.milestone).toBe(null);
    }
  });

  it('awards +100 at every 7-day milestone', async () => {
    mockNoExistingAward();
    const { awardStreakMilestoneIfDue, STREAK_MILESTONE_AWARD } = await import(
      '@/lib/db/coins'
    );
    for (const days of [7, 14, 21, 28, 35]) {
      const r = await awardStreakMilestoneIfDue('c1', days);
      expect(r.awarded, `streak=${days}`).toBe(true);
      expect(r.delta).toBe(STREAK_MILESTONE_AWARD);
      expect(r.milestone).toBe(days);
    }
  });

  it('is a no-op when the same milestone has already been awarded', async () => {
    mockExistingAward();
    const { awardStreakMilestoneIfDue } = await import('@/lib/db/coins');
    const r = await awardStreakMilestoneIfDue('c1', 7);
    expect(r.awarded).toBe(false);
    expect(r.milestone).toBe(7);
  });

  it('skips when currentStreak <= 0', async () => {
    mockNoExistingAward();
    const { awardStreakMilestoneIfDue } = await import('@/lib/db/coins');
    const r0 = await awardStreakMilestoneIfDue('c1', 0);
    expect(r0.awarded).toBe(false);
  });
});

describe('awardPerfectWeekIfDue', () => {
  it('awards +200 when no prior perfect-week transaction exists', async () => {
    mockNoExistingAward();
    const { awardPerfectWeekIfDue, PERFECT_WEEK_AWARD } = await import(
      '@/lib/db/coins'
    );
    const r = await awardPerfectWeekIfDue('c1', 'week-1');
    expect(r).toEqual({ awarded: true, delta: PERFECT_WEEK_AWARD });
  });

  it('is a no-op when a perfect-week transaction already exists for that week', async () => {
    mockExistingAward();
    const { awardPerfectWeekIfDue } = await import('@/lib/db/coins');
    const r = await awardPerfectWeekIfDue('c1', 'week-1');
    expect(r).toEqual({ awarded: false, delta: 0 });
  });
});
