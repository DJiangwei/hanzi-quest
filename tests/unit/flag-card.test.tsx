import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlagCard } from '@/components/play/items/FlagCard';
import type { CollectibleItem } from '@/lib/db/collections';

function makeItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
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

describe('FlagCard', () => {
  it('renders both Chinese and English country names', () => {
    render(<FlagCard item={makeItem()} owned />);
    expect(screen.getByText('中国')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
  });

  it('renders the flag emoji from the catalog', () => {
    const { container } = render(<FlagCard item={makeItem()} owned />);
    expect(container.textContent).toContain('🇨🇳');
  });

  it('renders the bilingual capital line in default (non-compact) mode', () => {
    render(<FlagCard item={makeItem()} owned />);
    expect(screen.getByText(/首都·北京/)).toBeInTheDocument();
    expect(screen.getByText(/Capital · Beijing/)).toBeInTheDocument();
  });

  it('hides capital line when compact=true', () => {
    render(<FlagCard item={makeItem()} owned compact />);
    expect(screen.queryByText(/首都·北京/)).not.toBeInTheDocument();
  });

  it('shows a 🔒 corner indicator when not owned', () => {
    const { container } = render(<FlagCard item={makeItem()} owned={false} />);
    expect(container.textContent).toContain('🔒');
  });

  it('applies the owned data attribute for styling/testing', () => {
    const { container } = render(<FlagCard item={makeItem()} owned />);
    const card = container.querySelector('[data-testid="flag-card"]');
    expect(card?.getAttribute('data-owned')).toBe('true');
  });

  it('renders the bilingual lore when size=lg and owned', () => {
    render(<FlagCard item={makeItem()} owned size="lg" />);
    expect(
      screen.getByText('首都：北京。大熊猫的故乡。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Capital: Beijing. Home of the giant panda!'),
    ).toBeInTheDocument();
  });

  it('falls back to a placeholder emoji when item.slug is unknown', () => {
    const item = makeItem({
      slug: 'made-up',
      imageUrl: null,
      nameZh: '虚构',
      nameEn: 'Madeup',
    });
    const { container } = render(<FlagCard item={item} owned />);
    expect(container.textContent).toContain('🏳️');
  });
});
