// tests/unit/finish-attempt-gift.test.ts
// Verifies that finishAttemptAction triggers claimWeeklyGiftIfDue on a fresh
// daily check-in and surfaces the result as giftPack in the return payload.
// Mock structure mirrors finish-level-boss.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
  awardCoins: vi.fn().mockResolvedValue(undefined),
  getLevelById: vi.fn().mockResolvedValue(null),
  checkAndGrantTrophies: vi.fn().mockResolvedValue([]),
  tickStreak: vi.fn().mockResolvedValue({
    currentStreak: 5,
    longestStreak: 5,
    ticked: true,
    reset: false,
    freezeBurned: false,
  }),
  awardDailyLoginIfDue: vi.fn().mockResolvedValue({ awarded: true, delta: 20 }),
  awardStreakMilestoneIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0, milestone: null }),
  pullCardForChild: vi.fn().mockResolvedValue({ granted: false, reason: 'non_boss' }),
  claimWeeklyGiftIfDue: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/play', () => ({
  startPlaySession: vi.fn(),
  endPlaySession: vi.fn(),
  hasPriorAttempt: mocks.hasPriorAttempt,
  recordSceneAttempt: mocks.recordSceneAttempt,
  upsertWeekProgress: vi.fn(),
  listLevelsForWeek: vi.fn(),
  getWeekProgress: vi.fn().mockResolvedValue(null),
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
  getLevelById: mocks.getLevelById,
}));
vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
  awardPerfectWeekIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  awardDailyLoginIfDue: mocks.awardDailyLoginIfDue,
  awardStreakMilestoneIfDue: mocks.awardStreakMilestoneIfDue,
}));
vi.mock('@/lib/db/streaks', () => ({
  tickStreak: mocks.tickStreak,
  todayUtcIso: () => '2026-06-04',
}));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/db/continent-rewards', () => ({ grantContinentRewards: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: vi.fn().mockResolvedValue({ id: 'w1' }),
  listCharactersForWeek: vi.fn(),
}));
vi.mock('@/lib/actions/gacha', () => ({
  pullCardForChild: mocks.pullCardForChild,
  claimWeeklyGiftIfDue: mocks.claimWeeklyGiftIfDue,
}));
vi.mock('@/lib/play/card-grants', () => ({
  pullCardForChild: mocks.pullCardForChild,
  claimWeeklyGiftIfDue: mocks.claimWeeklyGiftIfDue,
}));
vi.mock('@/lib/db/xp', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
}));
vi.mock('@/lib/db/quests', () => ({
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));

import { finishAttemptAction } from '@/lib/actions/play';

const VALID_INPUT = {
  sessionId: '11111111-2222-4333-a444-555555555555',
  weekLevelId: 'aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee',
  weekId: '33333333-4444-4555-a666-777777777777',
  childId: '22222222-3333-4444-a555-666666666666',
  correctCount: 4,
  totalCount: 4,
};

describe('finishAttemptAction giftPack (Card Economy v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireChild.mockResolvedValue({
      parent: { id: 'p1' },
      child: { id: 'c1' },
    });
    // Default: fresh daily check-in
    mocks.tickStreak.mockResolvedValue({
      currentStreak: 5,
      longestStreak: 5,
      ticked: true,
      reset: false,
      freezeBurned: false,
    });
    mocks.awardDailyLoginIfDue.mockResolvedValue({ awarded: true, delta: 20 });
  });

  it('returns giftPack=null when claimWeeklyGiftIfDue resolves null (gift not yet due)', async () => {
    mocks.claimWeeklyGiftIfDue.mockResolvedValue(null);

    const result = await finishAttemptAction(VALID_INPUT);

    expect(result.giftPack).toBeNull();
    expect(mocks.claimWeeklyGiftIfDue).toHaveBeenCalledWith('c1');
  });

  it('returns giftPack.cards with the expected length when gift is due', async () => {
    const mockCards = [
      { itemId: 'item-1', packId: 'pack-zodiac', packSlug: 'zodiac-v1', isDupe: false },
      { itemId: 'item-2', packId: 'pack-zodiac', packSlug: 'zodiac-v1', isDupe: true },
      { itemId: 'item-3', packId: 'pack-flags', packSlug: 'flags-v1', isDupe: false },
    ];
    mocks.claimWeeklyGiftIfDue.mockResolvedValue({ cards: mockCards });

    const result = await finishAttemptAction(VALID_INPUT);

    expect(result.giftPack).not.toBeNull();
    expect(result.giftPack!.cards).toHaveLength(3);
    expect(mocks.claimWeeklyGiftIfDue).toHaveBeenCalledWith('c1');
  });

  it('does NOT call claimWeeklyGiftIfDue when tick did not tick (not a fresh check-in)', async () => {
    mocks.tickStreak.mockResolvedValue({
      currentStreak: 5,
      longestStreak: 5,
      ticked: false,
      reset: false,
      freezeBurned: false,
    });

    const result = await finishAttemptAction(VALID_INPUT);

    expect(result.giftPack).toBeNull();
    expect(mocks.claimWeeklyGiftIfDue).not.toHaveBeenCalled();
  });

  it('does NOT call claimWeeklyGiftIfDue when daily login was not awarded (already played today)', async () => {
    // tick.ticked=true but daily already awarded earlier in the day
    mocks.awardDailyLoginIfDue.mockResolvedValue({ awarded: false, delta: 0 });

    const result = await finishAttemptAction(VALID_INPUT);

    expect(result.giftPack).toBeNull();
    expect(mocks.claimWeeklyGiftIfDue).not.toHaveBeenCalled();
  });

  it('always includes giftPack in return shape (null when no check-in, non-null when gift due)', async () => {
    // Verify giftPack key is always present on the returned object
    mocks.claimWeeklyGiftIfDue.mockResolvedValue({ cards: [] });

    const result = await finishAttemptAction(VALID_INPUT);

    expect(Object.keys(result)).toContain('giftPack');
  });
});
