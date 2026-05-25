import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  insertFn: vi.fn(),
}));
const powerupMock = vi.hoisted(() => ({
  consumePowerupAtomic: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: () => mocks.selectFn(),
    insert: () => mocks.insertFn(),
  },
}));

vi.mock('@/lib/db/powerups', () => ({
  consumePowerupAtomic: powerupMock.consumePowerupAtomic,
}));

import { tickStreak, todayUtcIso } from '@/lib/db/streaks';

function mockExistingStreak(row: unknown) {
  // `db.select().from(streaks).where(...).limit(1)` chain → returns array.
  mocks.selectFn.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => (row ? [row] : []),
      }),
    }),
  });
}

function mockInsertOk() {
  mocks.insertFn.mockReturnValue({
    values: () => ({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

beforeEach(() => {
  mocks.selectFn.mockReset();
  mocks.insertFn.mockReset();
  powerupMock.consumePowerupAtomic.mockReset();
  // Default: no freeze available (gap>1 tests that don't specifically set this will reset)
  powerupMock.consumePowerupAtomic.mockResolvedValue(false);
  mockInsertOk();
});

describe('tickStreak', () => {
  it('starts a new streak at 1 when no prior row exists', async () => {
    mockExistingStreak(null);
    const result = await tickStreak('c1', '2026-05-19');
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      ticked: true,
      reset: false,
      freezeBurned: false,
    });
  });

  it('is a no-op when called twice on the same UTC day', async () => {
    mockExistingStreak({
      currentStreak: 5,
      longestStreak: 7,
      lastPlayedDate: '2026-05-19',
      freezeTokens: 0,
    });
    const result = await tickStreak('c1', '2026-05-19');
    expect(result.ticked).toBe(false);
    expect(result.reset).toBe(false);
    expect(result.currentStreak).toBe(5);
  });

  it('increments when today is the day after lastPlayedDate', async () => {
    mockExistingStreak({
      currentStreak: 3,
      longestStreak: 3,
      lastPlayedDate: '2026-05-18',
      freezeTokens: 0,
    });
    const result = await tickStreak('c1', '2026-05-19');
    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 4,
      ticked: true,
      reset: false,
      freezeBurned: false,
    });
  });

  it('preserves the longest-streak record when current streak grows', async () => {
    mockExistingStreak({
      currentStreak: 3,
      longestStreak: 10,
      lastPlayedDate: '2026-05-18',
      freezeTokens: 0,
    });
    const result = await tickStreak('c1', '2026-05-19');
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(10);
  });

  it('resets to 1 when there is a gap of more than 1 day', async () => {
    mockExistingStreak({
      currentStreak: 4,
      longestStreak: 4,
      lastPlayedDate: '2026-05-15',
      freezeTokens: 0,
    });
    const result = await tickStreak('c1', '2026-05-19');
    expect(result.currentStreak).toBe(1);
    expect(result.ticked).toBe(true);
    expect(result.reset).toBe(true);
    expect(result.longestStreak).toBe(4);
  });
});

describe('todayUtcIso', () => {
  it('returns YYYY-MM-DD for the provided UTC moment', () => {
    expect(todayUtcIso(new Date('2026-05-19T23:30:00Z'))).toBe('2026-05-19');
    expect(todayUtcIso(new Date('2026-12-31T00:00:00Z'))).toBe('2026-12-31');
  });
});
