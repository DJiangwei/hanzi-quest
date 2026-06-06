import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  selectFn: vi.fn(),
  insertFn: vi.fn(),
  awardCoins: vi.fn(),
  awardXp: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: mocks.requireChild,
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.selectFn,
    insert: mocks.insertFn,
  },
}));

vi.mock('@/lib/db/coins', () => ({
  awardCoins: mocks.awardCoins,
}));

vi.mock('@/lib/db/xp', () => ({
  awardXp: mocks.awardXp,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { claimDailyChest } from '@/lib/actions/quests';

const CHILD_ID = 'child-abc';
const TODAY = new Date().toISOString().slice(0, 10);

function makeCompletedQuest(questId: string) {
  return {
    id: `q-${questId}`,
    childId: CHILD_ID,
    date: TODAY,
    questId,
    progress: 3,
    target: 3,
    completed: true,
    createdAt: new Date(),
  };
}

function mockSelectReturning(rows: unknown[]) {
  mocks.selectFn.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function mockInsertReturning(rows: unknown[]) {
  mocks.insertFn.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: CHILD_ID } });
  mocks.awardCoins.mockResolvedValue(undefined);
  mocks.awardXp.mockResolvedValue({ totalXp: 30, level: 1, leveledUp: false });
});

describe('claimDailyChest', () => {
  it('returns not_ready when fewer than 3 quests are completed', async () => {
    // Only 2 completed quests
    mockSelectReturning([
      makeCompletedQuest('complete_scenes'),
      makeCompletedQuest('perfect_scores'),
      { ...makeCompletedQuest('practice_scenes'), completed: false },
    ]);

    const result = await claimDailyChest(CHILD_ID);
    expect(result).toEqual({ ok: false, reason: 'not_ready' });
    expect(mocks.insertFn).not.toHaveBeenCalled();
    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('returns not_ready when no quests exist', async () => {
    mockSelectReturning([]);

    const result = await claimDailyChest(CHILD_ID);
    expect(result).toEqual({ ok: false, reason: 'not_ready' });
  });

  it('awards coins and XP on fresh claim', async () => {
    // 3 completed quests
    mockSelectReturning([
      makeCompletedQuest('complete_scenes'),
      makeCompletedQuest('perfect_scores'),
      makeCompletedQuest('practice_scenes'),
    ]);
    // Insert returns a new row (fresh claim)
    mockInsertReturning([{ childId: CHILD_ID, date: TODAY, coins: 75, claimedAt: new Date() }]);

    const result = await claimDailyChest(CHILD_ID);
    expect(result).toMatchObject({ ok: true, coins: 75 });
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ childId: CHILD_ID, reason: 'daily_chest' }),
    );
    expect(mocks.awardXp).toHaveBeenCalledWith(CHILD_ID, 30, 'daily_chest');
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/play/${CHILD_ID}`);
  });

  it('returns alreadyClaimed when insert returns no row (PK collision)', async () => {
    // 3 completed quests
    mockSelectReturning([
      makeCompletedQuest('complete_scenes'),
      makeCompletedQuest('perfect_scores'),
      makeCompletedQuest('practice_scenes'),
    ]);
    // Insert returns empty (conflict — already claimed), then select returns existing
    mocks.insertFn.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    // Second select to fetch existing chest row
    mockSelectReturning([{ childId: CHILD_ID, date: TODAY, coins: 60, claimedAt: new Date() }]);

    const result = await claimDailyChest(CHILD_ID);
    expect(result).toMatchObject({ ok: true, coins: 60, alreadyClaimed: true });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(mocks.awardXp).not.toHaveBeenCalled();
  });
});
