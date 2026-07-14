import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  insertFn: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.selectFn,
    insert: mocks.insertFn,
  },
}));

import { generateDailyQuests, getTodayQuests } from '@/lib/db/quests';

const CHILD_ID = 'child-abc';
const TODAY = '2026-06-06';

// Helper: make a chainable select mock that returns the given array
function makeSelectReturning(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function mockInsertOnConflictOk(insertedRows: unknown[]) {
  mocks.insertFn.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(insertedRows),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateDailyQuests', () => {
  it('returns existing rows if already generated today (idempotent)', async () => {
    const existingRows = [
      { id: 'q1', childId: CHILD_ID, date: TODAY, questId: 'complete_scenes', progress: 0, target: 3, completed: false },
      { id: 'q2', childId: CHILD_ID, date: TODAY, questId: 'perfect_scores', progress: 0, target: 2, completed: false },
      { id: 'q3', childId: CHILD_ID, date: TODAY, questId: 'practice_scenes', progress: 0, target: 2, completed: false },
    ];

    // First select: today's rows → already exist
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning(existingRows));

    const result = await generateDailyQuests(CHILD_ID, { bossUnlocked: false, hasFrontier: true });
    expect(result).toHaveLength(3);
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it('inserts 3 quests when none exist for today', async () => {
    // First select: today's rows → empty
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning([]));
    // Second select: yesterday's rows → empty (no exclusions)
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning([]));

    const newRows = [
      { id: 'q1', childId: CHILD_ID, date: TODAY, questId: 'complete_scenes', progress: 0, target: 3, completed: false },
      { id: 'q2', childId: CHILD_ID, date: TODAY, questId: 'perfect_scores', progress: 0, target: 2, completed: false },
      { id: 'q3', childId: CHILD_ID, date: TODAY, questId: 'practice_scenes', progress: 0, target: 2, completed: false },
    ];
    mockInsertOnConflictOk(newRows);

    const result = await generateDailyQuests(CHILD_ID, { bossUnlocked: false, hasFrontier: true });
    expect(result).toHaveLength(3);
    expect(mocks.insertFn).toHaveBeenCalledTimes(1);
  });

  it('excludes yesterday keys from new selection', async () => {
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning([]));
    // Yesterday's quests included complete_scenes
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning([
      { questId: 'complete_scenes' },
    ]));

    const newRows = [
      { id: 'q1', childId: CHILD_ID, date: TODAY, questId: 'perfect_scores', progress: 0, target: 2, completed: false },
      { id: 'q2', childId: CHILD_ID, date: TODAY, questId: 'practice_scenes', progress: 0, target: 2, completed: false },
      { id: 'q3', childId: CHILD_ID, date: TODAY, questId: 'earn_card', progress: 0, target: 1, completed: false },
    ];
    mockInsertOnConflictOk(newRows);

    const result = await generateDailyQuests(CHILD_ID, { bossUnlocked: false, hasFrontier: true });
    // boss_clear should not be picked (bossUnlocked=false) and complete_scenes excluded (yesterday)
    const questIds = result.map((r) => r.questId);
    expect(questIds).not.toContain('complete_scenes');
    expect(questIds).not.toContain('boss_clear');
  });
});

describe('getTodayQuests', () => {
  it('returns rows with their quest definitions merged', async () => {
    const rows = [
      { id: 'q1', childId: CHILD_ID, date: TODAY, questId: 'complete_scenes', progress: 1, target: 3, completed: false },
    ];
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning(rows));

    const result = await getTodayQuests(CHILD_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.questId).toBe('complete_scenes');
    expect(result[0]!.def).toBeDefined();
    expect(result[0]!.def?.labelZh).toBe('小小探险家');
  });

  it('returns empty array when no quests today', async () => {
    mocks.selectFn.mockReturnValueOnce(makeSelectReturning([]));
    const result = await getTodayQuests(CHILD_ID);
    expect(result).toHaveLength(0);
  });
});
