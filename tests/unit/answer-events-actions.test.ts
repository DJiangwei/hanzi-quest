// Answer-event piggyback on finishAttemptAction: events forwarded with
// server-derived context, absent → no logger call, logger failure → action
// result unchanged. Mock set mirrors tests/unit/play-xp-quest-ticks.test.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'attempt-ev-1' }),
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
  awardPerfectWeekIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
  pullCardForChild: vi
    .fn()
    .mockResolvedValue({ granted: false, reason: 'already_granted' }),
  claimWeeklyGiftIfDue: vi.fn().mockResolvedValue(null),
  getPlayableWeekForChild: vi.fn().mockResolvedValue({ id: 'w1', childId: 'c1' }),
  listLevelsForWeek: vi.fn().mockResolvedValue([]),
  getWeekProgress: vi.fn().mockResolvedValue(null),
  upsertWeekProgress: vi.fn().mockResolvedValue(undefined),
  endPlaySession: vi.fn().mockResolvedValue(undefined),
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
  logAnswerEventsSafe: vi.fn().mockResolvedValue(1),
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
  todayUtcIso: () => '2026-07-03',
}));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: mocks.getPlayableWeekForChild,
  listCharactersForWeek: vi.fn(),
}));
vi.mock('@/lib/play/card-grants', () => ({
  pullCardForChild: mocks.pullCardForChild,
  claimWeeklyGiftIfDue: mocks.claimWeeklyGiftIfDue,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/continent-rewards', () => ({
  grantContinentRewards: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: mocks.tickQuestProgressSafe }));
vi.mock('@/lib/db/answer-events', () => ({
  logAnswerEventsSafe: mocks.logAnswerEventsSafe,
}));

import { finishAttemptAction } from '@/lib/actions/play';

const SESSION = '11111111-2222-4333-a444-555555555555';
const CHILD = '22222222-3333-4444-a555-666666666666';
const WEEK = '33333333-4444-4555-a666-777777777777';
const LEVEL = 'aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee';
const CHAR = '99999999-8888-4777-a666-555555555555';

const BASE = {
  sessionId: SESSION,
  weekLevelId: LEVEL,
  weekId: WEEK,
  childId: CHILD,
  correctCount: 1,
  totalCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.recordSceneAttempt.mockResolvedValue({ id: 'attempt-ev-1' });
  mocks.awardXp.mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false });
  mocks.logAnswerEventsSafe.mockResolvedValue(1);
});

describe('finishAttemptAction events piggyback', () => {
  it('forwards events with server-derived child/week/source', async () => {
    const events = [{ sceneType: 'audio_pick', characterId: CHAR, correct: true }];
    await finishAttemptAction({ ...BASE, source: 'practice', events });
    expect(mocks.logAnswerEventsSafe).toHaveBeenCalledWith('c1', WEEK, 'practice', events);
  });

  it('defaults source to practice when absent', async () => {
    const events = [{ sceneType: 'audio_pick', characterId: CHAR, correct: false }];
    await finishAttemptAction({ ...BASE, events });
    expect(mocks.logAnswerEventsSafe).toHaveBeenCalledWith('c1', WEEK, 'practice', events);
  });

  it('does not call the logger when events are absent', async () => {
    await finishAttemptAction(BASE);
    expect(mocks.logAnswerEventsSafe).not.toHaveBeenCalled();
  });

  it('action result is unchanged when the logger rejects', async () => {
    mocks.logAnswerEventsSafe.mockRejectedValueOnce(new Error('boom'));
    const res = await finishAttemptAction({
      ...BASE,
      source: 'review',
      events: [{ sceneType: 'flashcard', characterId: CHAR, selfRating: 'got_it' }],
    });
    expect(res.coinsAwarded).toBeGreaterThanOrEqual(0);
    expect(res.xp.gained).toBeGreaterThan(0);
  });
});
