import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the story action module — this is the ONLY dependency the helper
// touches. The helper dynamic-imports it, so the mock must be in place
// before the dynamic import resolves.
const storyMock = vi.hoisted(() => ({
  generateStoryChapter: vi.fn(() => Promise.resolve({ id: 'c1' })),
}));
vi.mock('@/lib/actions/story', () => storyMock);

// `src/lib/actions/play.ts` is a `'use server'` module that statically imports
// a handful of DB / auth modules at the top. None of them are exercised by
// the helper under test, but they must resolve cleanly for the file to load.
// Mock them all out to keep the test hermetic (no DATABASE_URL needed).
vi.mock('@/lib/auth/guards', () => ({ requireChild: vi.fn() }));
vi.mock('@/lib/db/coins', () => ({
  awardCoins: vi.fn(),
  awardDailyLoginIfDue: vi.fn(),
  awardPerfectWeekIfDue: vi.fn(),
  awardStreakMilestoneIfDue: vi.fn(),
}));
vi.mock('@/lib/db/play', () => ({
  endPlaySession: vi.fn(),
  getLevelById: vi.fn(),
  getWeekProgress: vi.fn(),
  hasPriorAttempt: vi.fn(),
  isPerfectWeekForChild: vi.fn(),
  listLevelsForWeek: vi.fn(),
  recordSceneAttempt: vi.fn(),
  startPlaySession: vi.fn(),
  upsertWeekProgress: vi.fn(),
}));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/db/streaks', () => ({
  tickStreak: vi.fn(),
  todayUtcIso: vi.fn(() => '2026-05-28'),
}));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: vi.fn(),
  listCharactersForWeek: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/actions/gacha', () => ({
  pullCardForChild: vi.fn().mockResolvedValue({ granted: false, reason: 'already_granted_this_week' }),
}));
vi.mock('@/lib/db/xp', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 0, level: 1, leveledUp: false }),
}));
vi.mock('@/lib/db/quests', () => ({
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default behaviour: resolves successfully.
  storyMock.generateStoryChapter.mockImplementation(() =>
    Promise.resolve({ id: 'c1' }),
  );
});

describe('triggerEagerStoryGeneration', () => {
  it('dispatches generateStoryChapter with childId + weekId', async () => {
    const { triggerEagerStoryGeneration } = await import(
      '@/lib/actions/play'
    );
    // Caller (finishLevelAction) does NOT await — but the test does, so we
    // can deterministically assert the side effect.
    await triggerEagerStoryGeneration('k1', 'w1');
    expect(storyMock.generateStoryChapter).toHaveBeenCalledWith({
      childId: 'k1',
      weekId: 'w1',
    });
    expect(storyMock.generateStoryChapter).toHaveBeenCalledTimes(1);
  });

  it('swallows errors so the caller is unaffected', async () => {
    storyMock.generateStoryChapter.mockRejectedValueOnce(new Error('boom'));
    // Silence the expected console.error so test output stays clean.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { triggerEagerStoryGeneration } = await import(
        '@/lib/actions/play'
      );
      // The helper itself must not throw — error is logged + swallowed.
      await expect(
        triggerEagerStoryGeneration('k1', 'w1'),
      ).resolves.toBeUndefined();
      // It still attempted the call.
      expect(storyMock.generateStoryChapter).toHaveBeenCalledWith({
        childId: 'k1',
        weekId: 'w1',
      });
      // And the error path actually fired.
      expect(errSpy).toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });
});
