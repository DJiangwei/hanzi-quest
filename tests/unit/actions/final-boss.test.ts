import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (childId: string) => ({
    parent: { id: 'p' },
    child: { id: childId },
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const getPackBySlug = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  id: 'pk',
  slug: 'pirate-class-level-1',
}));
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
}));
const isMapFullyCleared = vi.fn<(...a: unknown[]) => unknown>(async () => true);
const recordFinalBossClear = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  firstClear: true,
}));
const grantMapChampionRewards = vi.fn<(...a: unknown[]) => unknown>(async () => ({
  card: {
    id: 'i',
    slug: 'champion-caribbean',
    packSlug: 'champions-v1',
    nameZh: 'x',
    nameEn: 'y',
    loreZh: null,
    loreEn: null,
    isDupe: false,
    shardsAfter: 0,
  },
  trophies: [{ slug: 'champion-caribbean' }],
}));
vi.mock('@/lib/db/final-boss', () => ({
  isMapFullyCleared: (...a: unknown[]) => isMapFullyCleared(...a),
  recordFinalBossClear: (...a: unknown[]) => recordFinalBossClear(...a),
  grantMapChampionRewards: (...a: unknown[]) => grantMapChampionRewards(...a),
}));

import { finishFinalBossAction } from '@/lib/actions/final-boss';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('finishFinalBossAction', () => {
  it('on first clear: records the clear, grants the bundle, returns card + trophies', async () => {
    const res = await finishFinalBossAction({
      childId: 'c1',
      packSlug: 'pirate-class-level-1',
    });
    expect(recordFinalBossClear).toHaveBeenCalledWith('c1', 'pk');
    expect(grantMapChampionRewards).toHaveBeenCalledWith('c1', 'pirate-class-level-1');
    expect(res.cardGrants).toHaveLength(1);
    expect(res.trophies).toHaveLength(1);
  });
  it('rejects when the map is not fully cleared (anti-cheat)', async () => {
    isMapFullyCleared.mockResolvedValueOnce(false);
    await expect(
      finishFinalBossAction({ childId: 'c1', packSlug: 'pirate-class-level-1' }),
    ).rejects.toThrow();
    expect(recordFinalBossClear).not.toHaveBeenCalled();
  });
  it('is idempotent: a repeat clear grants nothing again', async () => {
    recordFinalBossClear.mockResolvedValueOnce({ firstClear: false });
    const res = await finishFinalBossAction({
      childId: 'c1',
      packSlug: 'pirate-class-level-1',
    });
    expect(grantMapChampionRewards).not.toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(0);
  });
});
