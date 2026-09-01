import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  getWeekGateState: vi.fn(),
  getWeekProgress: vi.fn(),
  upsertWeekProgress: vi.fn(),
  endPlaySession: vi.fn(),
  awardCoins: vi.fn(),
  claimKeyVaultPrize: vi.fn(),
  isMapFullyCleared: vi.fn(),
  getPackSlugById: vi.fn(),
  creditPiggy: vi.fn(),
  pullCardForChild: vi
    .fn()
    .mockResolvedValue({ granted: false, reason: 'daily_cap_reached' }),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/piggy', () => ({ creditPiggy: mocks.creditPiggy }));
vi.mock('@/lib/db/bounties', () => ({ tickBountyProgress: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db/key-vault', () => ({ claimKeyVaultPrize: mocks.claimKeyVaultPrize }));
vi.mock('@/lib/db/final-boss', () => ({ isMapFullyCleared: mocks.isMapFullyCleared }));
vi.mock('@/lib/db/maps', () => ({ getPackSlugById: mocks.getPackSlugById }));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: mocks.getPlayableWeekForChild,
  getWeekGateState: mocks.getWeekGateState,
  isFrontierWeek: vi.fn().mockResolvedValue(false),
  listCharactersForWeek: vi.fn(),
}));
vi.mock('@/lib/db/play', () => ({
  startPlaySession: vi.fn(),
  endPlaySession: mocks.endPlaySession,
  hasPriorAttempt: vi.fn().mockResolvedValue(false),
  recordSceneAttempt: vi.fn().mockResolvedValue({ id: 'a1' }),
  upsertWeekProgress: mocks.upsertWeekProgress,
  listLevelsForWeek: vi.fn().mockResolvedValue([]),
  getWeekProgress: mocks.getWeekProgress,
  isPerfectWeekForChild: vi.fn().mockResolvedValue(false),
  getLevelById: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
  awardPerfectWeekIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  awardDailyLoginIfDue: vi.fn().mockResolvedValue({ awarded: false, delta: 0 }),
  awardStreakMilestoneIfDue: vi
    .fn()
    .mockResolvedValue({ awarded: false, delta: 0, milestone: null }),
}));
vi.mock('@/lib/db/streaks', () => ({
  tickStreak: vi.fn().mockResolvedValue({
    currentStreak: 1, longestStreak: 1, ticked: false, reset: false,
  }),
  todayUtcIso: () => '2026-08-31',
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/db/continent-rewards', () => ({ grantContinentRewards: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/db/trophies', () => ({ checkAndGrantTrophies: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/actions/gacha', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/db/xp', () => ({
  awardXp: vi.fn().mockResolvedValue({ totalXp: 10, level: 1, leveledUp: false }),
}));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined) }));

import { finishLevelAction } from '@/lib/actions/play';

const BOSS_RUN = {
  sessionId: '11111111-2222-4333-a444-555555555555',
  childId: '22222222-3333-4444-a555-666666666666',
  weekId: '33333333-4444-4555-a666-777777777777',
  section: 'boss' as const,
  totalScenesPassed: 1,
  totalScenesInWeek: 1,
  durationSeconds: 60,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.getPlayableWeekForChild.mockResolvedValue({
    id: 'w1', childId: null, curriculumPackId: 'pack-1',
  });
  mocks.getWeekProgress.mockResolvedValue(null); // first clear
  mocks.getWeekGateState.mockResolvedValue({
    isFrontier: false, isUnlocked: true, keysEarned: 4, keysTotal: 10,
  });
  mocks.isMapFullyCleared.mockResolvedValue(false);
  mocks.getPackSlugById.mockResolvedValue('pirate-class-level-1');
  mocks.claimKeyVaultPrize.mockResolvedValue({ card: null, coins: 0 });
  mocks.creditPiggy.mockResolvedValue({ credited: true });
});

describe('finishLevelAction — 存钱罐 payouts', () => {
  it('pays £1 on a FIRST weekly boss clear', async () => {
    await finishLevelAction(BOSS_RUN);
    expect(mocks.creditPiggy).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: 'c1',
        source: 'boss_clear',
        refId: BOSS_RUN.weekId,
        pence: 100,
      }),
    );
  });

  it('pays NOTHING on a REPEAT clear — bosses replay and a loss pays boss_courage', async () => {
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true });
    await finishLevelAction(BOSS_RUN);
    expect(mocks.creditPiggy).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: 'boss_clear' }),
    );
  });

  it('pays nothing at all for a review section run', async () => {
    await finishLevelAction({ ...BOSS_RUN, section: 'review' as const });
    expect(mocks.creditPiggy).not.toHaveBeenCalled();
  });

  it('pays £1 when the map vault opens', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(true);
    await finishLevelAction(BOSS_RUN);
    expect(mocks.creditPiggy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'key_vault', refId: 'pack-1', pence: 100,
      }),
    );
  });

  it('surfaces the award as a PENCE bonus, not a coin one', async () => {
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.bonuses.find((b) => b.reason === 'piggy')).toMatchObject({
      unit: 'pence',
      delta: 100,
    });
  });

  it('emits no bonus when the credit was a duplicate', async () => {
    mocks.creditPiggy.mockResolvedValue({ credited: false });
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.bonuses.find((b) => b.reason === 'piggy')).toBeUndefined();
  });

  it('still clears the boss when the piggy credit THROWS', async () => {
    mocks.creditPiggy.mockRejectedValue(new Error('db down'));
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.ok).toBe(true);
    expect(res.bossCleared).toBe(true);
    expect(res.bonuses.find((b) => b.reason === 'piggy')).toBeUndefined();
  });
});
