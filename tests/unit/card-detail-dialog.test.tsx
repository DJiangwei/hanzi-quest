import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardDetailDialog } from '@/components/play/CardDetailDialog';
import type { CollectibleItem } from '@/lib/db/collections';

function flagItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
  return {
    id: 'item-1',
    packId: 'pack-flags',
    slug: 'china',
    nameZh: '中国',
    nameEn: 'China',
    loreZh: '首都：北京。大熊猫的故乡。',
    loreEn: 'Capital: Beijing. Home of the giant panda!',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🇨🇳',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CardDetailDialog', () => {
  it("renders the pack's own card at lg (owned shows lore)", () => {
    render(
      <CardDetailDialog packSlug="flags-v1" item={flagItem()} owned onClose={vi.fn()} />,
    );
    // FlagCard at lg + owned renders the bilingual lore.
    expect(screen.getByText('首都：北京。大熊猫的故乡。')).toBeInTheDocument();
    expect(screen.getByTestId('flag-card')).toHaveAttribute('data-size', 'lg');
  });

  it('shows a locked teaser when the item is not owned', () => {
    render(
      <CardDetailDialog packSlug="flags-v1" item={flagItem()} owned={false} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/还没收集 \/ Not collected yet/)).toBeInTheDocument();
    // Unowned lg card hides the lore.
    expect(screen.queryByText('首都：北京。大熊猫的故乡。')).not.toBeInTheDocument();
  });

  it('calls onClose on the close button and on backdrop click', () => {
    const onClose = vi.fn();
    render(
      <CardDetailDialog packSlug="flags-v1" item={flagItem()} owned onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /关闭|Close/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('card-detail-dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing for an unregistered pack slug', () => {
    const { container } = render(
      <CardDetailDialog packSlug="nope-v1" item={flagItem()} owned onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
