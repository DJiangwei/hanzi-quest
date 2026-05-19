import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeaCreatureCard } from '@/components/play/items/SeaCreatureCard';
import type { CollectibleItem } from '@/lib/db/collections';

function makeItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
  return {
    id: 'item-1',
    packId: 'pack-sea',
    slug: 'octopus',
    nameZh: '章鱼',
    nameEn: 'Octopus',
    loreZh: '栖息地：礁石缝。八只腕足，超级聪明。',
    loreEn: 'Habitat: Rocky reefs. Eight arms and very clever.',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🐙',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('SeaCreatureCard', () => {
  it('renders both Chinese and English creature names', () => {
    render(<SeaCreatureCard item={makeItem()} owned />);
    expect(screen.getByText('章鱼')).toBeInTheDocument();
    expect(screen.getByText('Octopus')).toBeInTheDocument();
  });

  it('renders the creature emoji from the catalog', () => {
    const { container } = render(<SeaCreatureCard item={makeItem()} owned />);
    expect(container.textContent).toContain('🐙');
  });

  it('renders the bilingual habitat line in default (non-compact) mode', () => {
    render(<SeaCreatureCard item={makeItem()} owned />);
    expect(screen.getByText(/栖息地·礁石缝/)).toBeInTheDocument();
    expect(screen.getByText(/Habitat · Rocky reefs/)).toBeInTheDocument();
  });

  it('hides habitat line when compact=true', () => {
    render(<SeaCreatureCard item={makeItem()} owned compact />);
    expect(screen.queryByText(/栖息地·礁石缝/)).not.toBeInTheDocument();
  });

  it('shows a 🔒 corner indicator when not owned', () => {
    const { container } = render(
      <SeaCreatureCard item={makeItem()} owned={false} />,
    );
    expect(container.textContent).toContain('🔒');
  });

  it('applies the owned data attribute for styling/testing', () => {
    const { container } = render(<SeaCreatureCard item={makeItem()} owned />);
    const card = container.querySelector('[data-testid="sea-creature-card"]');
    expect(card?.getAttribute('data-owned')).toBe('true');
  });

  it('renders the bilingual lore when size=lg and owned', () => {
    render(<SeaCreatureCard item={makeItem()} owned size="lg" />);
    expect(
      screen.getByText('栖息地：礁石缝。八只腕足，超级聪明。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Habitat: Rocky reefs. Eight arms and very clever.'),
    ).toBeInTheDocument();
  });

  it('falls back to a placeholder emoji when item.slug is unknown', () => {
    const item = makeItem({
      slug: 'made-up',
      imageUrl: null,
      nameZh: '神秘',
      nameEn: 'Mystery',
    });
    const { container } = render(<SeaCreatureCard item={item} owned />);
    expect(container.textContent).toContain('🐚');
  });
});
