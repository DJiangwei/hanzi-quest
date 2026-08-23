import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const markGiftsSeenAction = vi.fn();
vi.mock('@/lib/actions/crew', () => ({
  markGiftsSeenAction: (...a: unknown[]) => markGiftsSeenAction(...a),
}));

// The chest is exercised by its own suite; here we only need the giver line and
// the onDone wiring, so stub it to a button that fires onDone.
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: ({ cards, onDone }: { cards: unknown[]; onDone: () => void }) => (
    <button data-testid="chest" data-count={cards.length} onClick={onDone}>
      open
    </button>
  ),
}));

import { GiftInbox, type InboxGift } from '@/components/play/GiftInbox';

const gift = (giftId: string): InboxGift => ({
  giftId,
  from: { zh: '红帆船长', en: 'Captain Redsail' },
  card: {
    id: `item-${giftId}`,
    slug: 'rat',
    packSlug: 'zodiac-v1',
    nameZh: '鼠',
    nameEn: 'Rat',
    loreZh: null,
    loreEn: null,
    isDupe: false,
    shardsAfter: 0,
  },
});

beforeEach(() => vi.clearAllMocks());

describe('GiftInbox', () => {
  it('renders nothing when there are no unseen gifts', () => {
    const { container } = render(<GiftInbox childId="c1" gifts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the giver bilingually, by nickname", () => {
    render(<GiftInbox childId="c1" gifts={[gift('g1')]} />);
    expect(screen.getByText(/来自 红帆船长 的礼物/)).toBeInTheDocument();
    expect(screen.getByText(/A gift from Captain Redsail/)).toBeInTheDocument();
  });

  it('stamps every gift seen when the chest run finishes', () => {
    render(<GiftInbox childId="c1" gifts={[gift('g1'), gift('g2')]} />);
    expect(screen.getByTestId('chest')).toHaveAttribute('data-count', '2');
    fireEvent.click(screen.getByTestId('chest'));
    expect(markGiftsSeenAction).toHaveBeenCalledWith({
      childId: 'c1',
      giftIds: ['g1', 'g2'],
    });
  });

  it('closes after opening, so a re-render does not replay the chest', () => {
    render(<GiftInbox childId="c1" gifts={[gift('g1')]} />);
    fireEvent.click(screen.getByTestId('chest'));
    expect(screen.queryByTestId('gift-inbox')).toBeNull();
  });

  // The binding negative constraint from the spec: no comparative figure, ever.
  it('shows no running total of gifts received', () => {
    render(<GiftInbox childId="c1" gifts={[gift('g1'), gift('g2')]} />);
    const text = screen.getByTestId('gift-inbox').textContent ?? '';
    expect(text).not.toMatch(/收到|received|总共|total|第\s*\d+\s*份/i);
  });
});
