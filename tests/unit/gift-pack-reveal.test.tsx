import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GiftPackReveal } from '@/components/play/GiftPackReveal';

describe('GiftPackReveal', () => {
  const cards = [
    { itemId: 'i1', packSlug: 'zodiac-v1', isDupe: false, shardsAfter: 0 },
    { itemId: 'i2', packSlug: 'flags-v1', isDupe: true, shardsAfter: 3 },
  ];

  it('renders a banner and one tile per card', () => {
    render(<GiftPackReveal cards={cards} onClose={vi.fn()} />);
    expect(screen.getByText(/大礼包/)).toBeInTheDocument();
    expect(screen.getAllByTestId('gift-card-tile')).toHaveLength(2);
  });

  it('shows a shard note for dupes', () => {
    render(<GiftPackReveal cards={cards} onClose={vi.fn()} />);
    expect(screen.getByText(/\+1 .*碎片|shard/i)).toBeInTheDocument();
  });

  it('renders nothing for empty cards', () => {
    const { container } = render(<GiftPackReveal cards={[]} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onClose when the collect button is clicked', async () => {
    const onClose = vi.fn();
    const { getByRole } = render(<GiftPackReveal cards={cards} onClose={onClose} />);
    getByRole('button', { name: /领取|collect/i }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
