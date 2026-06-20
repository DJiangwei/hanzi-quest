import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (childId: string) => ({ parent: { id: 'p1' }, child: { id: childId } })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const getPackBySlug = vi.fn<(...args: unknown[]) => unknown>();
const listChildCollection = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: (...a: unknown[]) => getPackBySlug(...a),
  listChildCollection: (...a: unknown[]) => listChildCollection(...a),
}));
const pullCardForChild = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: (...a: unknown[]) => pullCardForChild(...a) }));
const awardXp = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ totalXp: 100, level: 2, leveledUp: false }));
vi.mock('@/lib/db/xp', () => ({ awardXp: (...a: unknown[]) => awardXp(...a) }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: vi.fn() }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-06-20' }));

import { finishStudyLessonAction } from '@/lib/actions/study';

const ownedThree = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

beforeEach(() => {
  vi.clearAllMocks();
  getPackBySlug.mockResolvedValue({ id: 'pk', slug: 'animals-v1', gachaEligible: true });
  listChildCollection.mockResolvedValue(ownedThree);
});

describe('finishStudyLessonAction', () => {
  it('grants a card + XP on a passing score, scoped to the pack', async () => {
    pullCardForChild.mockResolvedValue({ granted: true, itemId: 'i1', slug: 'fox', packSlug: 'animals-v1', nameZh: '狐狸', nameEn: 'Fox', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(pullCardForChild).toHaveBeenCalledWith('c1', 'study', 'animals-v1:2026-06-20', 'animals-v1');
    expect(awardXp).toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(1);
    expect(res.xp.gained).toBeGreaterThan(0);
  });
  it('reports study_done_today on a same-day repeat (already_granted)', async () => {
    pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted', cardsToday: 3 });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(res.cardMessage).toBe('study_done_today');
    expect(res.cardGrants).toHaveLength(0);
    expect(awardXp).not.toHaveBeenCalled();
  });
  it('reports daily_cap_reached when the shared cap is hit', async () => {
    pullCardForChild.mockResolvedValue({ granted: false, reason: 'daily_cap_reached', cardsToday: 10 });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(res.cardMessage).toBe('daily_cap_reached');
  });
  it('grants nothing on a failing score', async () => {
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 40 });
    expect(pullCardForChild).not.toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(0);
  });
  it('grants nothing for a reward-only (non-gacha) pack', async () => {
    getPackBySlug.mockResolvedValue({ id: 'pk', slug: 'festivals-v1', gachaEligible: false });
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'festivals-v1', score: 100 });
    expect(pullCardForChild).not.toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(0);
  });
  it('grants nothing when the child owns fewer than 3 cards', async () => {
    listChildCollection.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const res = await finishStudyLessonAction({ childId: 'c1', packSlug: 'animals-v1', score: 100 });
    expect(pullCardForChild).not.toHaveBeenCalled();
  });
});
