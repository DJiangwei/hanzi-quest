// tests/unit/play-xp-quest-ticks.test.ts
// Task 8: Assert XP + quest ticks fire correctly in finishAttemptAction /
// finishLevelAction, and that result.xp is populated.
// All external boundaries are mocked; primary assertions in the action tests
// above remain unchanged.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'attempt-xp-1' }),
  awardCoins: vi.fn().mockResolvedValue(undefined),
  getLevelById: vi.fn().mockResolvedValue(null),
  checkAndGrantTrophies: vi.fn().mockResolvedValue([]),
  tickStreak: vi.fn().mockResolvedValue({
    currentStreak: 1,
    longestStreak: 1,
    ticked: false,
    reset: false,
    freezeBurned: false,
  }),
  awardDailyLoginIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  awardStreakMilestoneIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0, milestone: null }),
  awardPerfectWeekIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0 }),
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
  pullCardForChild: vi
    .fn()
    .mockResolvedValue({ granted: false, reason: 'already_granted_this_week' }),
  claimWeeklyGiftIfDue: vi.fn().mockResolvedValue(null),
  getPlayableWeekForChild: vi.fn().mockResolvedValue({ id: 'w1', childId: 'c1' }),
  listLevelsForWeek: vi.fn().mockResolvedValue([]),
  getWeekProgress: vi.fn().mockResolvedValue(null),
  upsertWeekProgress: vi.fn().mockResolvedValue(undefined),
  endPlaySession: vi.fn().mockResolvedValue(undefined),
  // XP + quest mocks — behaviour under test
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
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
  todayUtcIso: () => '2026-06-06',
}));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: mocks.getPlayableWeekForChild,
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/db/continent-rewards', () => ({ grantContinentRewards: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/db/xp', () => ({
  awardXp: mocks.awardXp,
}));
vi.mock('@/lib/db/quests', () => ({
  tickQuestProgressSafe: mocks.tickQuestProgressSafe,
}));

import { finishAttemptAction, finishLevelAction } from '@/lib/actions/play';

// ─── shared IDs ──────────────────────────────────��─────────────────────────
const SESSION_ID = '11111111-2222-4333-a444-555555555555';
const CHILD_ID = '22222222-3333-4444-a555-666666666666';
const WEEK_ID = '33333333-4444-4555-a666-777777777777';
const LEVEL_ID = 'aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee';

const BASE_ATTEMPT = {
  sessionId: SESSION_ID,
  weekLevelId: LEVEL_ID,
  weekId: WEEK_ID,
  childId: CHILD_ID,
  correctCount: 3,
  totalCount: 4,
};

const PERFECT_ATTEMPT = {
  sessionId: SESSION_ID,
  weekLevelId: LEVEL_ID,
  weekId: WEEK_ID,
  childId: CHILD_ID,
  correctCount: 4,
  totalCount: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.recordSceneAttempt.mockResolvedValue({ id: 'attempt-xp-1' });
  mocks.awardXp.mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false });
  mocks.tickQuestProgressSafe.mockResolvedValue(undefined);
});

// ─── finishAttemptAction ───────────────────────────────────────────────────

describe('finishAttemptAction — XP ticks', () => {
  it('awards scene_complete XP (10 pts) on a normal practice scene', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'audio_pick',
    });

    await finishAttemptAction(BASE_ATTEMPT);

    expect(mocks.awardXp).toHaveBeenCalledWith(
      'c1',
      10,
      'scene_complete',
      'attempt-xp-1',
    );
  });

  it('awards scene_perfect XP (5 pts) on a perfect score', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'audio_pick',
    });

    await finishAttemptAction(PERFECT_ATTEMPT);

    expect(mocks.awardXp).toHaveBeenCalledWith(
      'c1',
      5,
      'scene_perfect',
      'attempt-xp-1',
    );
  });

  it('does NOT award scene_perfect XP on a non-perfect score', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'audio_pick',
    });

    await finishAttemptAction(BASE_ATTEMPT); // 3/4 — not perfect

    const perfectCalls = mocks.awardXp.mock.calls.filter(
      (args: unknown[]) => args[2] === 'scene_perfect',
    );
    expect(perfectCalls).toHaveLength(0);
  });

  it('awards streak_milestone XP (100 pts) when milestone is awarded', async () => {
    mocks.tickStreak.mockResolvedValue({
      currentStreak: 7,
      longestStreak: 7,
      ticked: true,
      reset: false,
      freezeBurned: false,
    });
    mocks.awardDailyLoginIfDue.mockResolvedValue({ awarded: true, delta: 20 });
    mocks.awardStreakMilestoneIfDue.mockResolvedValue({
      awarded: true,
      delta: 100,
      milestone: 7,
    });

    await finishAttemptAction(BASE_ATTEMPT);

    expect(mocks.awardXp).toHaveBeenCalledWith(
      'c1',
      100,
      'streak_milestone',
      '7',
    );
  });

  it('result.xp is present and has gained=10 for a normal attempt', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'audio_pick',
    });
    mocks.awardXp.mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false });

    const result = await finishAttemptAction(BASE_ATTEMPT);

    expect(result.xp).toBeDefined();
    expect(result.xp.gained).toBe(10);
    expect(result.xp.level).toBe(1);
    expect(result.xp.leveledUp).toBe(false);
  });

  it('result.xp.gained=15 for a perfect scene (10 + 5)', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'translate_pick',
    });
    mocks.awardXp.mockResolvedValue({ totalXp: 15, level: 1, leveledUp: false });

    const result = await finishAttemptAction(PERFECT_ATTEMPT);

    expect(result.xp.gained).toBe(15);
  });
});

describe('finishAttemptAction — quest ticks', () => {
  it('ticks complete_scenes quest on every attempt', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'sentence_cloze',
    });

    await finishAttemptAction(BASE_ATTEMPT);

    // tickQuestProgressSafe is called as void; allow microtasks to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'complete_scenes',
      1,
    );
  });

  it('ticks practice_scenes for a practice scene type', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'audio_pick',
    });

    await finishAttemptAction(BASE_ATTEMPT);
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'practice_scenes',
      1,
    );
  });

  it('ticks review_flashcards for a flashcard scene type', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'flashcard',
    });

    await finishAttemptAction(BASE_ATTEMPT);
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'review_flashcards',
      1,
    );
    // Should NOT also tick practice_scenes
    const practiceCalls = mocks.tickQuestProgressSafe.mock.calls.filter(
      (args: unknown[]) => args[1] === 'practice_scenes',
    );
    expect(practiceCalls).toHaveLength(0);
  });

  it('ticks perfect_scores on a perfect attempt', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'translate_pick',
    });

    await finishAttemptAction(PERFECT_ATTEMPT);
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'perfect_scores',
      1,
    );
  });

  it('does NOT tick perfect_scores on a non-perfect attempt', async () => {
    mocks.getLevelById.mockResolvedValue({
      id: LEVEL_ID,
      weekId: WEEK_ID,
      sceneType: 'translate_pick',
    });

    await finishAttemptAction(BASE_ATTEMPT);
    await new Promise((r) => setTimeout(r, 0));

    const perfectCalls = mocks.tickQuestProgressSafe.mock.calls.filter(
      (args: unknown[]) => args[1] === 'perfect_scores',
    );
    expect(perfectCalls).toHaveLength(0);
  });
});

// ─── finishLevelAction ─────────────────────────────────────────────────────

describe('finishLevelAction — boss clear XP + quest ticks', () => {
  function setupBoss() {
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);
  }

  it('awards boss_clear XP (50 pts) on boss clear', async () => {
    setupBoss();

    await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardXp).toHaveBeenCalledWith(
      'c1',
      50,
      'boss_clear',
      SESSION_ID,
    );
  });

  it('ticks boss_clear quest on boss clear', async () => {
    setupBoss();

    await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'boss_clear',
      1,
    );
  });

  it('ticks full_level quest on boss clear', async () => {
    setupBoss();

    await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'c1',
      'full_level',
      1,
    );
  });

  it('ticks earn_card quest when cardGrants.length > 0', async () => {
    setupBoss();
    mocks.pullCardForChild.mockResolvedValue({
      granted: true,
      itemId: 'item-1',
      packId: 'pack-1',
      packSlug: 'zodiac-v1',
      slug: 'rat',
      nameZh: '鼠',
      nameEn: 'Rat',
      loreZh: null,
      loreEn: null,
      isDupe: false,
      shardsAfter: 0,
      cardsToday: 1,
    });

    await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    await new Promise((r) => setTimeout(r, 0));

    const earnCardCalls = mocks.tickQuestProgressSafe.mock.calls.filter(
      (args: unknown[]) => args[1] === 'earn_card',
    );
    expect(earnCardCalls.length).toBeGreaterThan(0);
    expect(earnCardCalls[0]?.[2]).toBe(1); // 1 card granted
  });

  it('does NOT tick boss_clear XP when a non-boss section finishes', async () => {
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      section: 'practice',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    const bossCalls = mocks.awardXp.mock.calls.filter(
      (args: unknown[]) => args[2] === 'boss_clear',
    );
    expect(bossCalls).toHaveLength(0);
  });

  it('result.xp is present with gained=50 on boss clear', async () => {
    setupBoss();
    mocks.awardXp.mockResolvedValue({ totalXp: 50, level: 1, leveledUp: false });

    const result = await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(result.xp).toBeDefined();
    expect(result.xp.gained).toBe(50);
  });

  it('result.xp.gained=0 when a non-boss section finishes', async () => {
    mocks.getWeekProgress.mockResolvedValue(null);

    const result = await finishLevelAction({
      sessionId: SESSION_ID,
      childId: CHILD_ID,
      weekId: WEEK_ID,
      section: 'practice',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(result.xp.gained).toBe(0);
  });
});
