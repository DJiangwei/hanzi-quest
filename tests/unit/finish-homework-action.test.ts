import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'c1' } }),
  getPlayableWeekForChild: vi.fn().mockResolvedValue({ id: 'w1' }),
  pullCardForChild: vi.fn(),
  awardCoins: vi.fn().mockResolvedValue(undefined),
  awardXp: vi.fn().mockResolvedValue({ totalXp: 30, level: 1, leveledUp: false }),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild, assertParent: vi.fn() }));
vi.mock('@/lib/db/weeks', () => ({ getPlayableWeekForChild: mocks.getPlayableWeekForChild, getWeekOwnedBy: vi.fn() }));
vi.mock('@/lib/actions/gacha', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: mocks.awardCoins }));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: mocks.tickQuestProgressSafe }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-06-12' }));
vi.mock('@/lib/db/homework', () => ({ listHomeworkItems: vi.fn(), weekHasHomework: vi.fn(), createHomeworkItem: vi.fn(), updateHomeworkItem: vi.fn(), deleteHomeworkItem: vi.fn(), reorderHomeworkItems: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { finishHomeworkAction } from '@/lib/actions/homework';

const granted = {
  granted: true as const, itemId: 'i1', packId: 'p1', packSlug: 'flags', slug: 'cn',
  nameZh: '中国', nameEn: 'China', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0, cardsToday: 1,
};

// Valid UUIDs for the action input (schema validates with .uuid()).
const CHILD_ID = '22222222-3333-4444-a555-666666666666';
const WEEK_ID = '33333333-4444-4555-a666-777777777777';

beforeEach(() => vi.clearAllMocks());

describe('finishHomeworkAction', () => {
  it('granted → awards coins + XP and returns the card', async () => {
    mocks.pullCardForChild.mockResolvedValue(granted);
    const res = await finishHomeworkAction({ childId: CHILD_ID, weekId: WEEK_ID });
    // child.id comes from the requireChild mock ('c1'); refId uses the input weekId.
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'homework', `${WEEK_ID}:2026-06-12`);
    expect(mocks.awardCoins).toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(1);
    expect(res.cardMessage).toBeNull();
  });

  it('already_granted → no coins, homework_done_today', async () => {
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const res = await finishHomeworkAction({ childId: CHILD_ID, weekId: WEEK_ID });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(res.cardGrants).toEqual([]);
    expect(res.cardMessage).toBe('homework_done_today');
  });

  it('daily_cap_reached → no coins, daily_cap_reached', async () => {
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'daily_cap_reached' });
    const res = await finishHomeworkAction({ childId: CHILD_ID, weekId: WEEK_ID });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(res.cardMessage).toBe('daily_cap_reached');
  });
});
