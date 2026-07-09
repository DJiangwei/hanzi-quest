// R1/R2a/R3 server-side behavior (spec 2026-07-06-anti-avoidance-rebalance).
// Mock set mirrors tests/unit/answer-events-actions.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
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
  awardBossCourageIfDue: vi.fn().mockResolvedValue({ awarded: true, delta: 30 }),
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
  countPracticeClearedToday: vi.fn().mockResolvedValue(0),
  pullCardForChild: vi
    .fn()
    .mockResolvedValue({ granted: false, reason: 'already_granted' }),
  claimWeeklyGiftIfDue: vi.fn().mockResolvedValue(null),
  safePackCompleteTrophy: vi.fn().mockResolvedValue(undefined),
  getPlayableWeekForChild: vi.fn().mockResolvedValue({ id: 'w1', childId: 'c1' }),
  listLevelsForWeek: vi.fn().mockResolvedValue([]),
  getWeekProgress: vi.fn().mockResolvedValue(null),
  upsertWeekProgress: vi.fn().mockResolvedValue(undefined),
  endPlaySession: vi.fn().mockResolvedValue(undefined),
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
  logAnswerEventsSafe: vi.fn().mockResolvedValue(0),
}))

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
  countPracticeClearedToday: mocks.countPracticeClearedToday,
}));
vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
  awardPerfectWeekIfDue: mocks.awardPerfectWeekIfDue,
  awardDailyLoginIfDue: mocks.awardDailyLoginIfDue,
  awardStreakMilestoneIfDue: mocks.awardStreakMilestoneIfDue,
  awardBossCourageIfDue: mocks.awardBossCourageIfDue,
}));
vi.mock('@/lib/db/streaks', () => ({
  tickStreak: mocks.tickStreak,
  todayUtcIso: () => '2026-07-06',
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
  safePackCompleteTrophy: mocks.safePackCompleteTrophy,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/continent-rewards', () => ({
  grantContinentRewards: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: mocks.tickQuestProgressSafe }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: mocks.logAnswerEventsSafe }));

import { claimBossCourageAction, finishAttemptAction } from '@/lib/actions/play';

const SESSION = '11111111-2222-4333-a444-555555555555';
const CHILD = '22222222-3333-4444-a555-666666666666';
const WEEK = '33333333-4444-4555-a666-777777777777';
const LEVEL = 'aaaaaaaa-bbbb-4ccc-addd-eeeeeeeeeeee';

const granted = {
  granted: true as const,
  itemId: 'i1',
  packId: 'p1',
  packSlug: 'flags-v1',
  slug: 'cn',
  nameZh: '中国',
  nameEn: 'China',
  loreZh: null,
  loreEn: null,
  isDupe: false,
  shardsAfter: 0,
  cardsToday: 1,
};

const BASE = {
  sessionId: SESSION,
  weekLevelId: LEVEL,
  weekId: WEEK,
  childId: CHILD,
  correctCount: 1,
  totalCount: 1,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.recordSceneAttempt.mockResolvedValue({ id: 'attempt-1' });
  mocks.awardXp.mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false });
  mocks.countPracticeClearedToday.mockResolvedValue(0);
  mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted' });
  mocks.awardBossCourageIfDue.mockResolvedValue({ awarded: true, delta: 30 });
});

describe('R3: practice card via daily-cumulative threshold', () => {
  it('grants when the 8th distinct practice scene clears today', async () => {
    mocks.countPracticeClearedToday.mockResolvedValue(8);
    mocks.pullCardForChild.mockResolvedValue(granted);

    const res = await finishAttemptAction({ ...BASE, source: 'practice' });

    expect(mocks.countPracticeClearedToday).toHaveBeenCalledWith('c1', WEEK, '2026-07-06');
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'practice', `${WEEK}:2026-07-06`);
    expect(res.cardGrants).toHaveLength(1);
    expect(res.cardGrants[0].slug).toBe('cn');
  });

  it('does not pull below the threshold', async () => {
    mocks.countPracticeClearedToday.mockResolvedValue(7);
    const res = await finishAttemptAction({ ...BASE, source: 'practice' });
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
    expect(res.cardGrants).toEqual([]);
  });

  it('a repeat past the threshold dedupes via the grants log (no second card)', async () => {
    mocks.countPracticeClearedToday.mockResolvedValue(9);
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const res = await finishAttemptAction({ ...BASE, source: 'practice' });
    expect(res.cardGrants).toEqual([]);
  });

  it('never pulls for review/boss sources or wrong answers', async () => {
    mocks.countPracticeClearedToday.mockResolvedValue(20);
    await finishAttemptAction({ ...BASE, source: 'review' });
    await finishAttemptAction({ ...BASE, source: 'boss' });
    await finishAttemptAction({ ...BASE, source: 'practice', correctCount: 0 });
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
  });

  it('a grant failure never fails the attempt', async () => {
    mocks.countPracticeClearedToday.mockRejectedValue(new Error('db down'));
    const res = await finishAttemptAction({ ...BASE, source: 'practice' });
    expect(res.coinsAwarded).toBeGreaterThanOrEqual(0);
    expect(res.cardGrants).toEqual([]);
  });
});

describe('R2a: claimBossCourageAction', () => {
  it('awards via the idempotent helper and reports the delta', async () => {
    const res = await claimBossCourageAction(CHILD);
    expect(mocks.awardBossCourageIfDue).toHaveBeenCalledWith('c1', '2026-07-06');
    expect(res).toEqual({ awarded: true, delta: 30 });
  });

  it('passes through the not-awarded (already claimed today) case', async () => {
    mocks.awardBossCourageIfDue.mockResolvedValue({ awarded: false, delta: 0 });
    const res = await claimBossCourageAction(CHILD);
    expect(res.awarded).toBe(false);
  });
});
