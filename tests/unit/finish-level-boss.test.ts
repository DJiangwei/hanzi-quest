import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  listLevelsForWeek: vi.fn(),
  getWeekProgress: vi.fn(),
  upsertWeekProgress: vi.fn(),
  endPlaySession: vi.fn(),
  awardCoins: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/weeks', () => ({
  getPlayableWeekForChild: mocks.getPlayableWeekForChild,
  listCharactersForWeek: vi.fn(),
}));
vi.mock('@/lib/db/play', () => ({
  startPlaySession: vi.fn(),
  endPlaySession: mocks.endPlaySession,
  hasPriorAttempt: vi.fn(),
  recordSceneAttempt: vi.fn(),
  upsertWeekProgress: mocks.upsertWeekProgress,
  listLevelsForWeek: mocks.listLevelsForWeek,
  getWeekProgress: mocks.getWeekProgress,
}));
vi.mock('@/lib/db/coins', () => ({ awardCoins: mocks.awardCoins }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { finishLevelAction } from '@/lib/actions/play';

describe('finishLevelAction boss-clear', () => {
  beforeEach(() => vi.clearAllMocks());
  it('awards +300 coins and sets bossCleared=true when last scene was boss + all scenes passed', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // No prior progress row — first clear
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.upsertWeekProgress).toHaveBeenCalledWith(
      expect.objectContaining({ bossCleared: true }),
    );
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ delta: 300, reason: 'boss_clear' }),
    );
  });

  it('does NOT award boss bonus when last scene was not boss', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'word_match', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('does NOT award boss bonus when scenes < total (boss skipped)', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    mocks.getWeekProgress.mockResolvedValue(null);

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 1,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('does NOT re-award +300 coins when bossCleared was already true', async () => {
    mocks.requireChild.mockResolvedValue({ parent: { id: 'p1' }, child: { id: 'c1' } });
    mocks.getPlayableWeekForChild.mockResolvedValue({ id: 'w1', childId: 'c1' });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: {} },
      { id: 'l2', position: 1, sceneType: 'boss', sceneConfig: {} },
    ]);
    // Simulate: week_progress already has bossCleared=true from a prior successful run
    mocks.getWeekProgress.mockResolvedValue({ bossCleared: true, freePullClaimed: false });

    await finishLevelAction({
      sessionId: '11111111-2222-4333-a444-555555555555',
      childId: '22222222-3333-4444-a555-666666666666',
      weekId: '33333333-4444-4555-a666-777777777777',
      totalScenesPassed: 2,
      totalScenesInWeek: 2,
      durationSeconds: 120,
    });

    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });
});
