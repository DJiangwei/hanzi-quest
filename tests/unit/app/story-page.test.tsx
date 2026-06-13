import { describe, expect, it, vi, beforeEach } from 'vitest';

// Story mode is HIDDEN (2026-06-13) — the page calls notFound() before rendering.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// Minimal mocks so the module's top-level imports resolve (postgres-pulling
// modules must be stubbed even though notFound() throws before they run).
vi.mock('@/lib/db/story', () => ({
  getStoryChapterByWeek: vi.fn(),
  listStoryChaptersForChild: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/actions/story', () => ({
  generateStoryChapter: vi.fn(),
  markChapterReadAction: vi.fn(),
}));
vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(() => Promise.resolve({ child: { id: 'k1', displayName: 'Captain' } })),
}));
vi.mock('@/lib/db/shop', () => ({ getEquippedAvatar: vi.fn(() => Promise.resolve({})) }));
vi.mock('@/lib/db/pets', () => ({ getEquippedPet: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/components/play/story/ChapterCard', () => ({ ChapterCard: () => null }));
vi.mock('@/components/play/story/ChapterBody', () => ({ ChapterBody: () => null }));
vi.mock('@/components/play/MarkChapterReadOnMount', () => ({ MarkChapterReadOnMount: () => null }));

import { notFound } from 'next/navigation';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Chapter view page (story hidden)', () => {
  it('calls notFound() — story mode is hidden, never generates', async () => {
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page')).default;
    await expect(
      Page({ params: Promise.resolve({ childId: 'k1', weekId: 'w1' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
