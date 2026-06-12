import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertParent: vi.fn().mockResolvedValue({ id: 'p1' }),
  getWeekOwnedBy: vi.fn().mockResolvedValue({ id: 'w1' }),
  createHomeworkItem: vi.fn().mockResolvedValue('h1'),
  updateHomeworkItem: vi.fn().mockResolvedValue(undefined),
  deleteHomeworkItem: vi.fn().mockResolvedValue(undefined),
  reorderHomeworkItems: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth/guards', () => ({ assertParent: mocks.assertParent, requireChild: vi.fn() }));
vi.mock('@/lib/db/weeks', () => ({ getWeekOwnedBy: mocks.getWeekOwnedBy, getPlayableWeekForChild: vi.fn() }));
vi.mock('@/lib/db/homework', () => ({
  createHomeworkItem: mocks.createHomeworkItem,
  updateHomeworkItem: mocks.updateHomeworkItem,
  deleteHomeworkItem: mocks.deleteHomeworkItem,
  reorderHomeworkItems: mocks.reorderHomeworkItems,
  listHomeworkItems: vi.fn(), weekHasHomework: vi.fn(),
}));
vi.mock('@/lib/actions/gacha', () => ({ pullCardForChild: vi.fn() }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: vi.fn() }));
vi.mock('@/lib/db/xp', () => ({ awardXp: vi.fn() }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: vi.fn() }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-06-12' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { addHomeworkItemAction, deleteHomeworkItemAction } from '@/lib/actions/homework';

beforeEach(() => vi.clearAllMocks());

describe('homework parent actions', () => {
  it('addHomeworkItemAction validates config + creates the item', async () => {
    const id = await addHomeworkItemAction('w1', 'sentence_order', { tokens: ['我', '爱', '你'] });
    expect(id).toBe('h1');
    expect(mocks.createHomeworkItem).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'w1', type: 'sentence_order' }),
    );
  });

  it('addHomeworkItemAction rejects an invalid config', async () => {
    await expect(
      addHomeworkItemAction('w1', 'sentence_order', { tokens: ['x'] }),
    ).rejects.toThrow();
    expect(mocks.createHomeworkItem).not.toHaveBeenCalled();
  });

  it('deleteHomeworkItemAction calls the db', async () => {
    await deleteHomeworkItemAction('w1', 'h1');
    expect(mocks.deleteHomeworkItem).toHaveBeenCalledWith('h1');
  });
});
