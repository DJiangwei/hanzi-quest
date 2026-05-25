import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  getSectionStatsForChild: vi.fn(),
  listLevelsForWeek: vi.fn(),
  getCharactersWithDetailsForWeek: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__${path}`);
  }),
  notFound: vi.fn(() => { throw new Error('__NOT_FOUND__'); }),
}));

// @/db must be mocked before importOriginal('@/lib/db/play') is called,
// otherwise the Drizzle client init throws "DATABASE_URL is not set".
vi.mock('@/db', () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/weeks', () => ({ getPlayableWeekForChild: mocks.getPlayableWeekForChild }));
vi.mock('@/lib/db/play', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/db/play')>();
  return {
    ...orig,
    getSectionStatsForChild: mocks.getSectionStatsForChild,
    listLevelsForWeek: mocks.listLevelsForWeek,
  };
});
vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: mocks.getCharactersWithDetailsForWeek,
}));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

// Mock SceneRunner to a simple sentinel so the test isn't dragged into its internals
vi.mock('@/components/scenes/SceneRunner', () => ({
  SceneRunner: () => null,
}));
vi.mock('@/lib/db/powerups', () => ({
  grantStarterPowerupsIfNeeded: vi.fn().mockResolvedValue(false),
  getPowerupCounts: vi.fn().mockResolvedValue({ hint: 0, skip: 0, streak_freeze: 0 }),
}));

import SectionPage from '@/app/play/[childId]/level/[weekId]/[section]/page';

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    if (typeof m === 'function' && 'mockReset' in m) m.mockReset();
  }
  // Re-establish redirect/notFound throw behavior after reset
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`__REDIRECT__${path}`);
  });
  mocks.notFound.mockImplementation(() => { throw new Error('__NOT_FOUND__'); });

  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
  mocks.getPlayableWeekForChild.mockResolvedValue({
    id: 'w1', weekNumber: 5, label: 'Week 5',
  });
  mocks.listLevelsForWeek.mockResolvedValue([
    { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: { segment: 'review' } },
    { id: 'l2', position: 1, sceneType: 'audio_pick', sceneConfig: { segment: 'sound' } },
    { id: 'l3', position: 12, sceneType: 'boss', sceneConfig: { segment: 'boss' } },
  ]);
  mocks.getCharactersWithDetailsForWeek.mockResolvedValue([]);
});

describe('SectionPage boss route guard', () => {
  it('redirects to hub when section=boss and practice.done < threshold', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 10, total: 10 },
      practice: { done: 3, total: 12 },
      boss: { done: 0, total: 1 },
    });
    await expect(
      SectionPage({
        params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'boss' }),
      }),
    ).rejects.toThrow('__REDIRECT__/play/c1/week/w1');
  });

  it('allows boss when practice.done >= threshold', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 10, total: 10 },
      practice: { done: 7, total: 12 },
      boss: { done: 0, total: 1 },
    });
    // Should not throw a __REDIRECT__ — page renders (returns SceneRunner)
    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'boss' }),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('allows review and practice unconditionally', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 0, total: 10 },
      practice: { done: 0, total: 12 },
      boss: { done: 0, total: 1 },
    });
    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'review' }),
    });
    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'practice' }),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('returns notFound for invalid section', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 0, total: 0 },
      practice: { done: 0, total: 0 },
      boss: { done: 0, total: 0 },
    });
    await expect(
      SectionPage({
        params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'invalid' }),
      }),
    ).rejects.toThrow('__NOT_FOUND__');
  });

  it('returns notFound when section has no levels', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 0, total: 10 },
      practice: { done: 0, total: 12 },
      boss: { done: 0, total: 0 },   // 0 total → no boss for this week (N<10)
    });
    mocks.listLevelsForWeek.mockResolvedValue([
      { id: 'l1', position: 0, sceneType: 'flashcard', sceneConfig: { segment: 'review' } },
    ]);
    await expect(
      SectionPage({
        params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'practice' }),
      }),
    ).rejects.toThrow('__NOT_FOUND__');
  });
});
