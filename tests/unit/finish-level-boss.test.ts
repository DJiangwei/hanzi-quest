import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  listLevelsForWeek: vi.fn(),
  getWeekProgress: vi.fn(),
  upsertWeekProgress: vi.fn(),
  endPlaySession: vi.fn(),
  awardCoins: vi.fn(),
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
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
  todayUtcIso: () => '2026-05-19',
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));
vi.mock('@/lib/actions/gacha', () => ({
  pullCardForChild: mocks.pullCardForChild,
}));

import { finishAttemptAction, finishLevelAction } from '@/lib/actions/play';

describe('finishLevelAction boss-clear', () => {
  beforeEach(() => vi.clearAllMocks());
  it('awards +300 coins and sets bossCleared=true when last scene was boss + all scenes passed', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // No prior progress row — first clear
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.upsertWeekProgress).toHaveBeenCalledWith(
      expect.objectContaining({ bossCleared: true }),
    );
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ delta: 300, reason: 'boss_clear' }),
    );
  });

  it('does NOT award boss bonus when last scene was not boss', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'word_match', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('does NOT award boss bonus when scenes < total (boss skipped)', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 1,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('does NOT re-award +300 coins when bossCleared was already true', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // Simulate: week_progress already has bossCleared=true from a prior successful run
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true, freePullClaimed: false });

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });
});

describe('finishLevelAction return shape (PR #51)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns freePullClaimed=false when the child has no progress yet', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // No prior progress row
    mocks.getWeekProgress.mockResolvedValue(null);

    const result = await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 60,
    });

    expect(result.freePullClaimed).toBe(false);
  });

  it('returns freePullClaimed=true when child already claimed the boss chest', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // Simulate: boss cleared + chest already pulled
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true, freePullClaimed: true });

    const result = await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 60,
    });

    expect(result.freePullClaimed).toBe(true);
  });
});

describe('finishLevelAction card grant (cardGrants array)', () => {
  const BOSS_SESSION_ID = '11111111-2222-4333-a444-555555555555';
  const CHILD_ID = '22222222-3333-4444-a555-666666666666';
  const WEEK_ID = '33333333-4444-4555-a666-777777777777';

  const grantedResult = {
    granted: true as const,
    itemId: 'item-1',
    packId: 'pack-1',
    packSlug: 'flags',
    slug: 'flag-cn',
    nameZh: '中国',
    nameEn: 'China',
    loreZh: null as null,
    loreEn: null as null,
    isDupe: false,
    shardsAfter: 0,
    cardsToday: 1,
  };

  beforeEach(() => vi.clearAllMocks());

  it('calls pullCardForChild on boss clear and returns cardGrants with one entry', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);
    mocks.pullCardForChild.mockResolvedValue(grantedResult);

    const result = await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(result.cardGrants).toHaveLength(1);
    expect(result.cardGrants[0]).toEqual(expect.objectContaining({ slug: 'flag-cn', nameEn: 'China' }));
    expect(mocks.pullCardForChild).toHaveBeenCalledWith(
      'c1',
      'boss_clear',
      BOSS_SESSION_ID,
    );
  });

  it('returns cardGrants=[] when boss was NOT cleared (non-boss last scene)', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'word_match', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);

    const result = await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(result.cardGrants).toEqual([]);
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
  });

  it('returns cardGrants=[] when scenes < total (boss not passed)', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);

    const result = await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 1,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(result.cardGrants).toEqual([]);
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
  });

  it('calls pullCardForChild even on repeat boss clears (skipped grant → cardGrants=[])', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // Prior session already cleared boss
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true, freePullClaimed: false });
    // pullCardForChild returns skipped (already granted this week)
    mocks.pullCardForChild.mockResolvedValue({
      granted: false,
      reason: 'already_granted_this_week',
    });

    const result = await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    // Skipped grant → not included in the array
    expect(result.cardGrants).toEqual([]);
    expect(mocks.pullCardForChild).toHaveBeenCalledWith(
      'c1',
      'boss_clear',
      BOSS_SESSION_ID,
    );
  });

  it('returns cardGrants with length 2 when boss AND perfect-week both grant', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);
    mocks.isPerfectWeekForChild.mockResolvedValue(true);
    mocks.awardPerfectWeekIfDue.mockResolvedValue({ awarded: true, delta: 200 });
    // Both boss and perfect_week grant a card
    mocks.pullCardForChild.mockResolvedValue(grantedResult);

    const result = await finishLevelAction({
      sessionId: BOSS_SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(result.cardGrants).toHaveLength(2);
  });
});

describe('finishAttemptAction trophy pipeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns granted trophies from checkAndGrantTrophies via scene-clear kind', async () => {
    mocks.requireChild.mockResolvedValue({
      parent: { id: 'p1' },
      child: { id: 'c1' },
    });
    mocks.hasPriorAttempt.mockResolvedValue(false);
    mocks.recordSceneAttempt.mockResolvedValue({ id: 'attempt-1' });
    mocks.getLevelById.mockResolvedValue({
      id: 'level_pinyin',
      weekId: 'w1',
      sceneType: 'pinyin_pick',
    });
    // Return a trophy only for the scene-clear call; level-complete and
    // coin-award calls return empty so the assertion is unambiguous.
    mocks.checkAndGrantTrophies
      .mockResolvedValueOnce([
        {
          slug: 'first-pinyin-pick',
          nameZh: '拼音小能手',
          nameEn: 'Pinyin Apprentice',
          emoji: '🅰️',
        },
      ])
      .mockResolvedValue([]);

    const result = await finishAttemptAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      weekLevelId: 'aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee',
      weekId: '33333333-4444-4555-a666-777777777777',
      childId: '22222222-3333-4444-a555-666666666666',
      correctCount: 1,
      totalCount: 1,
    });

    expect(result.trophies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'first-pinyin-pick' }),
      ]),
    );
  });
});
