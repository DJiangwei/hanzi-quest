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
  pullCardForChild: vi
    .fn()
    .mockResolvedValue({ granted: false, reason: 'daily_cap_reached' }),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
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
  tickStreak: vi.fn().mockResolvedValue({ currentStreak: 1, longestStreak: 1, ticked: false, reset: false }),
  todayUtcIso: () => '2026-07-26',
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

const VAULT_CARD = {
  id: 'i1',
  slug: 'vault-caribbean',
  packSlug: 'key-vault-v1',
  nameZh: '加勒比宝藏',
  nameEn: 'The Caribbean Hoard',
  loreZh: '十把钥匙。',
  loreEn: 'Ten keys.',
  isDupe: false,
  shardsAfter: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
  mocks.getPlayableWeekForChild.mockResolvedValue({
    id: 'w1',
    childId: null,
    curriculumPackId: 'pack-1',
  });
  mocks.getWeekProgress.mockResolvedValue(null); // first clear
  mocks.getWeekGateState.mockResolvedValue({
    isFrontier: false,
    isUnlocked: true,
    keysEarned: 4,
    keysTotal: 10,
  });
  mocks.isMapFullyCleared.mockResolvedValue(false);
  mocks.getPackSlugById.mockResolvedValue('pirate-class-level-1');
  mocks.claimKeyVaultPrize.mockResolvedValue({ card: null, coins: 0 });
});

describe('finishLevelAction — 🗝️ key shard (T3)', () => {
  it('surfaces a key bonus with the post-clear count on a FIRST boss clear', async () => {
    const res = await finishLevelAction(BOSS_RUN);
    const key = res.bonuses.find((b) => b.reason === 'key_shard');
    expect(key).toBeDefined();
    // Gate was read BEFORE the upsert (4/10), so this clear makes it 5.
    expect(key!.labelZh).toContain('5/10');
    expect(key!.labelEn).toContain('5/10');
  });

  it('pays no key on a REPEAT clear (the key is already on the ring)', async () => {
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true });
    const res = await finishLevelAction(BOSS_RUN);
    expect(res.bonuses.find((b) => b.reason === 'key_shard')).toBeUndefined();
    expect(mocks.claimKeyVaultPrize).not.toHaveBeenCalled();
  });

  it('pays no key when a non-boss section finishes', async () => {
    const res = await finishLevelAction({ ...BOSS_RUN, section: 'practice' });
    expect(res.bonuses.find((b) => b.reason === 'key_shard')).toBeUndefined();
  });
});

describe('finishLevelAction — 💎 key vault grand prize (T3)', () => {
  it('opens the vault when this clear completes the map', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(true);
    mocks.claimKeyVaultPrize.mockResolvedValue({ card: VAULT_CARD, coins: 1000 });

    const res = await finishLevelAction(BOSS_RUN);

    expect(mocks.claimKeyVaultPrize).toHaveBeenCalledWith(
      'c1',
      'pack-1',
      'pirate-class-level-1',
    );
    expect(res.cardGrants).toContainEqual(VAULT_CARD);
    expect(res.bonuses).toContainEqual(
      expect.objectContaining({ reason: 'key_vault', delta: 1000 }),
    );
  });

  it('does not touch the vault while keys are still missing', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(false);
    const res = await finishLevelAction(BOSS_RUN);
    expect(mocks.claimKeyVaultPrize).not.toHaveBeenCalled();
    expect(res.bonuses.find((b) => b.reason === 'key_vault')).toBeUndefined();
  });

  it('reports no coin bonus when the vault was already opened (idempotent claim)', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(true);
    mocks.claimKeyVaultPrize.mockResolvedValue({ card: null, coins: 0 });

    const res = await finishLevelAction(BOSS_RUN);

    expect(mocks.claimKeyVaultPrize).toHaveBeenCalled();
    expect(res.bonuses.find((b) => b.reason === 'key_vault')).toBeUndefined();
    expect(res.cardGrants.some((c) => c.packSlug === 'key-vault-v1')).toBe(false);
  });

  it('still clears the boss when the vault claim throws', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(true);
    mocks.claimKeyVaultPrize.mockRejectedValue(new Error('pack not seeded'));

    const res = await finishLevelAction(BOSS_RUN);

    expect(res.bossCleared).toBe(true);
    expect(mocks.upsertWeekProgress).toHaveBeenCalledWith(
      expect.objectContaining({ bossCleared: true }),
    );
    expect(res.bonuses.find((b) => b.reason === 'key_vault')).toBeUndefined();
  });

  it('skips the vault when the map has no treasure mapped (slug lookup fails)', async () => {
    mocks.isMapFullyCleared.mockResolvedValue(true);
    mocks.getPackSlugById.mockResolvedValue(null);
    const res = await finishLevelAction(BOSS_RUN);
    expect(mocks.claimKeyVaultPrize).not.toHaveBeenCalled();
    expect(res.bossCleared).toBe(true);
  });
});
