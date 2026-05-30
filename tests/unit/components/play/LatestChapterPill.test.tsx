import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const dbStoryMock = vi.hoisted(() => ({
  getLatestUnreadChapter: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));
vi.mock('@/lib/db/story', () => dbStoryMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LatestChapterPill', () => {
  it('renders nothing when no unread chapter', async () => {
    dbStoryMock.getLatestUnreadChapter.mockResolvedValueOnce(null);
    const { LatestChapterPill } = await import(
      '@/components/play/LatestChapterPill'
    );
    const ui = await LatestChapterPill({ childId: 'k1' });
    const { container } = render(ui ?? <></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a link to the latest unread chapter', async () => {
    dbStoryMock.getLatestUnreadChapter.mockResolvedValueOnce({
      id: 'c1',
      weekId: 'w1',
      readAt: null,
    });
    const { LatestChapterPill } = await import(
      '@/components/play/LatestChapterPill'
    );
    const ui = await LatestChapterPill({ childId: 'k1' });
    render(ui ?? <></>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/k1/story/w1');
    expect(link).toHaveTextContent(/你最新的故事|latest chapter/i);
  });
});
