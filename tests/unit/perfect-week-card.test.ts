import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  listLevelsForWeek: vi.fn(),
  getWeekProgress: vi.fn(),
  upsertWeekProgress: vi.fn(),
  endPlaySession: vi.fn(),
  awardCoins: vi.fn(),
  isPerfectWeekForChild: vi.fn().mockResolvedValue(true),
  awardPerfectWeekIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0 }),
  awardDailyLoginIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0 }),
  awardStreakMilestoneIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0, milestone: null }),
  tickStreak: vi
    .fn()
    .mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      ticked: false,
      reset: false,
    }),
  checkAndGrantTrophies: vi.fn().mockResolvedValue([]),
  getLevelById: vi.fn().mockResolvedValue(null),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  pullCardForChild: vi.fn().mockResolvedValue({ granted: false, reason: 'already_granted_this_week' }),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/bounties', () => ({ tickBountyProgress: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: mocks.getPlayableWeekForChild,
  listCharactersForWeek: vi.fn(),
}));
vi.mock('@/lib/db/play', () => ({
  startPlaySession: vi.fn(),
  endPlaySession: mocks.endPlaySession,
  hasPriorAttempt: mocks.hasPriorAttempt,
  recordSceneAttempt: mocks.recordSceneAttempt,
  upsertWeekProgress: mocks.upsertWeekProgress,
  listLevelsForWeek: mocks.listLevelsForWeek,
  getWeekProgress: mocks.getWeekProgress,
  isPerfectWeekForChild: mocks.isPerfectWeekForChild,
  getLevelById: mocks.getLevelById,
}));
vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
  awardPerfectWeekIfDue: mocks.awardPerfectWeekIfDue,
  awardDailyLoginIfDue: mocks.awardDailyLoginIfDue,
  awardStreakMilestoneIfDue: mocks.awardStreakMilestoneIfDue,
}));
vi.mock('@/lib/db/streaks', () => ({
  tickStreak: mocks.tickStreak,
  todayUtcIso: () => '2026-05-31',
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/db/continent-rewards', () => ({ grantContinentRewards: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));
vi.mock('@/lib/actions/gacha', () => ({
  pullCardForChild: mocks.pullCardForChild,
}));
vi.mock('@/lib/play/card-grants', () => ({
  pullCardForChild: mocks.pullCardForChild,
}));
vi.mock('@/lib/db/xp', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
}));
vi.mock('@/lib/db/quests', () => ({
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));

import { finishLevelAction } from '@/lib/actions/play';

const BOSS_SESSION_ID = '11111111-2222-4333-a444-555555555555';
const CHILD_ID = '22222222-3333-4444-a555-666666666666';
const WEEK_ID = '33333333-4444-4555-a666-777777777777';

/** Standard boss-clear level setup */
function setupBossClearLevels() {
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
  mocks.listLevelsForWeek.mockResolvedValue([
    { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
    { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
  ]);
  mocks.getWeekProgress.mockResolvedValue(null);
}

describe('awardPerfectWeekIfDue card grant (PR #52)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls pullCardForChild with source=perfect_week on first award', async () => {
    setupBossClearLevels();
    // isPerfectWeekForChild already defaults to true in mocks above
    // First-time perfect_week award
    mocks.awardPerfectWeekIfDue.mockResolvedValue({ awarded: true, delta: 200 });
    mocks.pullCardForChild.mockResolvedValue({
      granted: true,
      packSlug: 'zodiac-v1',
      item: { id: 'item-1', nameZh: '鼠', nameEn: 'Rat', emoji: '🐭', rarity: 'common' },
      isNew: true,
      shardsDelta: 0,
    });

    await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    // pullCardForChild must be called twice: once for boss_clear, once for perfect_week
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'perfect_week', WEEK_ID);
  });

  it('does NOT call pullCardForChild with perfect_week when already-awarded (re-call)', async () => {
    setupBossClearLevels();
    // awardPerfectWeekIfDue reports already-awarded
    mocks.awardPerfectWeekIfDue.mockResolvedValue({ awarded: false, delta: 0 });
    // pullCardForChild for boss_clear will still be called; track it
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted_this_week' });

    await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    // perfect_week source must NOT appear in any call
    const perfectWeekCalls = mocks.pullCardForChild.mock.calls.filter(
      (args) => args[1] === 'perfect_week',
    );
    expect(perfectWeekCalls).toHaveLength(0);
  });
});
