import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  pullCardForChild: vi.fn(),
  awardCoins: vi.fn(),
  awardXp: vi.fn(),
  logAnswerEventsSafe: vi.fn(),
  tickQuestProgressSafe: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/play/card-grants', () => ({ pullCardForChild: mocks.pullCardForChild }));
vi.mock('@/lib/db/coins', () => ({ awardCoins: mocks.awardCoins }));
vi.mock('@/lib/db/xp', () => ({ awardXp: mocks.awardXp }));
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: mocks.logAnswerEventsSafe }));
vi.mock('@/lib/db/quests', () => ({ tickQuestProgressSafe: mocks.tickQuestProgressSafe }));
vi.mock('@/lib/db/streaks', () => ({ todayUtcIso: () => '2026-09-01' }));

import { finishReviewAction } from '@/lib/actions/review';

const GRANTED = {
  granted: true as const,
  itemId: 'i1',
  slug: 'rat',
  packSlug: 'zodiac-v1',
  nameZh: '鼠',
  nameEn: 'Rat',
  loreZh: null,
  loreEn: null,
  isDupe: false,
  shardsAfter: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' }, parent: { id: 'p1' } });
  mocks.pullCardForChild.mockResolvedValue(GRANTED);
  mocks.awardCoins.mockResolvedValue(undefined);
  mocks.awardXp.mockResolvedValue({ totalXp: 100, level: 3, leveledUp: false });
  mocks.logAnswerEventsSafe.mockResolvedValue(0);
});

describe('finishReviewAction', () => {
  it('gates on requireChild before any write', async () => {
    mocks.requireChild.mockRejectedValue(new Error('not yours'));
    await expect(finishReviewAction({ childId: 'other', score: 100 })).rejects.toThrow();
    expect(mocks.pullCardForChild).not.toHaveBeenCalled();
    expect(mocks.awardCoins).not.toHaveBeenCalled();
  });

  it('claims the card once per UTC day, globally', async () => {
    await finishReviewAction({ childId: 'c1', score: 100 });
    expect(mocks.pullCardForChild).toHaveBeenCalledWith('c1', 'daily_review', '2026-09-01');
  });

  it('pays coins and XP only on the granted branch', async () => {
    await finishReviewAction({ childId: 'c1', score: 100 });
    expect(mocks.awardCoins).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c1', delta: 40, reason: 'daily_review' }),
    );
    expect(mocks.awardXp).toHaveBeenCalledWith('c1', 15, 'daily_review', '2026-09-01');
  });

  it('pays NOTHING on a second run the same day', async () => {
    mocks.pullCardForChild.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const res = await finishReviewAction({ childId: 'c1', score: 100 });
    expect(mocks.awardCoins).not.toHaveBeenCalled();
    expect(mocks.awardXp).not.toHaveBeenCalled();
    expect(res.coinsAwarded).toBe(0);
  });

  it('pays the SAME whether she got 6/6 or 1/6', async () => {
    // Completing pays, not scoring. A review that punished wrong answers would
    // be a test, and this product deliberately does not test her — the same
    // reasoning behind boss_courage paying out on a FAILED boss.
    const perfect = await finishReviewAction({ childId: 'c1', score: 100 });
    vi.clearAllMocks();
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' }, parent: { id: 'p1' } });
    mocks.pullCardForChild.mockResolvedValue(GRANTED);
    mocks.awardXp.mockResolvedValue({ totalXp: 100, level: 3, leveledUp: false });
    const rough = await finishReviewAction({ childId: 'c1', score: 17 });
    expect(rough.coinsAwarded).toBe(perfect.coinsAwarded);
    expect(rough.xp.gained).toBe(perfect.xp.gained);
  });

  it("logs telemetry under 'daily_review', set server-side", async () => {
    await finishReviewAction({
      childId: 'c1',
      score: 50,
      // A client could claim any source; the action must ignore it.
      events: [{ sceneType: 'audio_pick', correct: true, source: 'boss' }],
    });
    expect(mocks.logAnswerEventsSafe).toHaveBeenCalledWith(
      'c1',
      null,
      'daily_review',
      expect.any(Array),
    );
  });

  it('still completes when the card grant throws', async () => {
    mocks.pullCardForChild.mockRejectedValue(new Error('db down'));
    await expect(finishReviewAction({ childId: 'c1', score: 100 })).resolves.toMatchObject({
      ok: true,
      coinsAwarded: 0,
    });
  });
});
