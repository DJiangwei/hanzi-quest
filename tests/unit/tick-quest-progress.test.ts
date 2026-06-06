import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  updateFn: vi.fn(),
  awardXp: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.selectFn,
    update: mocks.updateFn,
  },
}));

vi.mock('@/lib/db/xp', () => ({
  awardXp: mocks.awardXp,
}));

import { tickQuestProgress } from '@/lib/db/quests';

const CHILD_ID = 'child-abc';
const TODAY = new Date().toISOString().slice(0, 10);

function makeRow(overrides: Partial<{
  id: string; questId: string; progress: number; target: number; completed: boolean; date: string;
}> = {}) {
  return {
    id: 'row-1',
    childId: CHILD_ID,
    date: TODAY,
    questId: 'complete_scenes',
    progress: 0,
    target: 3,
    completed: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function mockSelectReturning(rows: unknown[]) {
  mocks.selectFn.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function mockUpdateOk() {
  mocks.updateFn.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.awardXp.mockResolvedValue({ totalXp: 20, level: 1, leveledUp: false });
  mockUpdateOk();
});

describe('tickQuestProgress', () => {
  it('increments progress for an incomplete quest', async () => {
    mockSelectReturning([makeRow({ progress: 0, target: 3 })]);

    const result = await tickQuestProgress(CHILD_ID, 'complete_scenes', 1);
    expect(result.ticked).toBe(true);
    expect(result.completed).toBe(false);
    expect(mocks.updateFn).toHaveBeenCalledTimes(1);
    expect(mocks.awardXp).not.toHaveBeenCalled();
  });

  it('caps progress at target', async () => {
    mockSelectReturning([makeRow({ progress: 2, target: 3 })]);

    const result = await tickQuestProgress(CHILD_ID, 'complete_scenes', 10);
    expect(result.ticked).toBe(true);
    // progress capped at 3
    const setCall = mocks.updateFn().set.mock.calls[0]?.[0];
    expect(setCall?.progress).toBe(3);
  });

  it('completes the quest and awards XP when reaching target', async () => {
    mockSelectReturning([makeRow({ progress: 2, target: 3 })]);

    const result = await tickQuestProgress(CHILD_ID, 'complete_scenes', 1);
    expect(result.ticked).toBe(true);
    expect(result.completed).toBe(true);
    expect(mocks.awardXp).toHaveBeenCalledWith(
      CHILD_ID,
      20, // xp from complete_scenes def
      'daily_quest',
      'row-1',
    );
  });

  it('is a no-op when the quest is not held today', async () => {
    mockSelectReturning([]);

    const result = await tickQuestProgress(CHILD_ID, 'complete_scenes', 1);
    expect(result.ticked).toBe(false);
    expect(mocks.updateFn).not.toHaveBeenCalled();
    expect(mocks.awardXp).not.toHaveBeenCalled();
  });

  it('is a no-op when the quest is already completed', async () => {
    mockSelectReturning([makeRow({ completed: true })]);

    const result = await tickQuestProgress(CHILD_ID, 'complete_scenes', 1);
    expect(result.ticked).toBe(false);
    expect(mocks.updateFn).not.toHaveBeenCalled();
    expect(mocks.awardXp).not.toHaveBeenCalled();
  });

  it('returns the def for the completed quest', async () => {
    mockSelectReturning([makeRow({ progress: 2, target: 3 })]);

    const result = await tickQuestProgress(CHILD_ID, 'complete_scenes', 1);
    expect(result.def?.key).toBe('complete_scenes');
    expect(result.def?.labelZh).toBe('小小探险家');
  });
});
