import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const dbStoryMock = vi.hoisted(() => ({
  getStoryChapterByWeek: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listStoryChaptersForChild: vi.fn<
    (...args: unknown[]) => Promise<unknown[]>
  >(() => Promise.resolve([])),
}));
vi.mock('@/lib/db/story', () => dbStoryMock);

const actionMock = vi.hoisted(() => ({
  generateStoryChapter: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  markChapterReadAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));
vi.mock('@/lib/actions/story', () => actionMock);

const authMock = vi.hoisted(() => ({
  requireChild: vi.fn(() =>
    Promise.resolve({ child: { id: 'k1', displayName: 'Yinuo' } }),
  ),
}));
vi.mock('@/lib/auth/guards', () => authMock);

const shopMock = vi.hoisted(() => ({
  getEquippedAvatar: vi.fn(() => Promise.resolve({})),
}));
vi.mock('@/lib/db/shop', () => shopMock);

const petMock = vi.hoisted(() => ({
  getEquippedPet: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/db/pets', () => petMock);

vi.mock('@/components/play/story/ChapterCard', () => ({
  ChapterCard: ({ chapterNumber }: { chapterNumber: number }) => (
    <div data-testid="card">Chapter {chapterNumber}</div>
  ),
}));
vi.mock('@/components/play/story/ChapterBody', () => ({
  ChapterBody: ({ bodyZh, bodyEn }: { bodyZh: string; bodyEn: string }) => (
    <div data-testid="body">
      {bodyZh}|{bodyEn}
    </div>
  ),
}));
vi.mock('@/components/play/MarkChapterReadOnMount', () => ({
  MarkChapterReadOnMount: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Chapter view page', () => {
  it('renders the existing chapter without re-calling generate', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce({
      id: 'c1',
      weekId: 'w1',
      bodyZh: '哈',
      bodyEn: 'Ha',
      tone: 'standard',
      createdAt: new Date(),
    });
    dbStoryMock.listStoryChaptersForChild.mockResolvedValueOnce([
      { id: 'c1', weekId: 'w1', createdAt: new Date() },
    ]);
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page'))
      .default;
    const ui = await Page({
      params: Promise.resolve({ childId: 'k1', weekId: 'w1' }),
    });
    render(ui);
    expect(screen.getByTestId('body')).toHaveTextContent('哈|Ha');
    expect(actionMock.generateStoryChapter).not.toHaveBeenCalled();
  });

  it('falls back to synchronous generation when chapter is missing', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    actionMock.generateStoryChapter.mockResolvedValueOnce({
      id: 'c1',
      weekId: 'w1',
      bodyZh: 'X',
      bodyEn: 'Y',
      tone: 'standard',
      createdAt: new Date(),
    });
    dbStoryMock.listStoryChaptersForChild.mockResolvedValueOnce([
      { id: 'c1', weekId: 'w1', createdAt: new Date() },
    ]);
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page'))
      .default;
    const ui = await Page({
      params: Promise.resolve({ childId: 'k1', weekId: 'w1' }),
    });
    render(ui);
    expect(actionMock.generateStoryChapter).toHaveBeenCalledWith({
      childId: 'k1',
      weekId: 'w1',
    });
    expect(screen.getByTestId('body')).toHaveTextContent('X|Y');
  });

  it('renders an error UI when generation throws', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    actionMock.generateStoryChapter.mockRejectedValueOnce(
      new Error('deepseek down'),
    );
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page'))
      .default;
    const ui = await Page({
      params: Promise.resolve({ childId: 'k1', weekId: 'w1' }),
    });
    render(ui);
    expect(screen.getByText(/try again|再试一次/i)).toBeInTheDocument();
  });
});
