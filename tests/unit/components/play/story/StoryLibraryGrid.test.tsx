import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/play/story/ChapterCard', () => ({
  ChapterCard: ({ chapterNumber }: { chapterNumber: number }) => (
    <div data-testid="card">Chapter {chapterNumber}</div>
  ),
}));

import { StoryLibraryGrid } from '@/components/play/story/StoryLibraryGrid';

describe('StoryLibraryGrid', () => {
  it('renders cards newest-first', () => {
    const chapters = [
      { id: 'c3', weekId: 'w3', tone: 'standard', bodyZh: 'c', createdAt: new Date('2026-05-29') },
      { id: 'c2', weekId: 'w2', tone: 'triumphant', bodyZh: 'b', createdAt: new Date('2026-05-22') },
      { id: 'c1', weekId: 'w1', tone: 'narrow_escape', bodyZh: 'a', createdAt: new Date('2026-05-15') },
    ];
    render(
      <StoryLibraryGrid childId="k1" chapters={chapters as never} />,
    );
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
    // First card should be most recent → chapter 3
    expect(cards[0]).toHaveTextContent('Chapter 3');
    expect(cards[2]).toHaveTextContent('Chapter 1');
  });

  it('renders an empty state when no chapters', () => {
    render(<StoryLibraryGrid childId="k1" chapters={[]} />);
    expect(screen.getByText(/no chapters yet|还没有故事/i)).toBeInTheDocument();
  });
});
