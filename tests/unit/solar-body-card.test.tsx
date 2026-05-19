import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SolarBodyCard } from '@/components/play/items/SolarBodyCard';
import type { CollectibleItem } from '@/lib/db/collections';

function makeItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
  return {
    id: 'item-1',
    packId: 'pack-solar',
    slug: 'earth',
    nameZh: '地球',
    nameEn: 'Earth',
    loreZh: '类型：岩石行星。我们的家，唯一有海洋的行星。',
    loreEn: 'Type: Rocky planet. Our home — the only planet with oceans.',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🌍',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('SolarBodyCard', () => {
  it('renders both Chinese and English body names', () => {
    render(<SolarBodyCard item={makeItem()} owned />);
    expect(screen.getByText('地球')).toBeInTheDocument();
    expect(screen.getByText('Earth')).toBeInTheDocument();
  });

  it('renders the body emoji from the catalog', () => {
    const { container } = render(<SolarBodyCard item={makeItem()} owned />);
    expect(container.textContent).toContain('🌍');
  });

  it('renders the bilingual type badge in default (non-compact) mode', () => {
    render(<SolarBodyCard item={makeItem()} owned />);
    expect(screen.getByText('岩石行星')).toBeInTheDocument();
    expect(screen.getByText('Rocky planet')).toBeInTheDocument();
  });

  it('hides type badge when compact=true', () => {
    render(<SolarBodyCard item={makeItem()} owned compact />);
    expect(screen.queryByText('岩石行星')).not.toBeInTheDocument();
  });

  it('tags the card with its type for color-coding', () => {
    const { container } = render(<SolarBodyCard item={makeItem()} owned />);
    const card = container.querySelector('[data-testid="solar-body-card"]');
    expect(card?.getAttribute('data-type')).toBe('rocky');
  });

  it('tags the Sun as type=star', () => {
    const { container } = render(
      <SolarBodyCard item={makeItem({ slug: 'sun' })} owned />,
    );
    const card = container.querySelector('[data-testid="solar-body-card"]');
    expect(card?.getAttribute('data-type')).toBe('star');
  });

  it('tags Saturn as type=gas', () => {
    const { container } = render(
      <SolarBodyCard item={makeItem({ slug: 'saturn' })} owned />,
    );
    const card = container.querySelector('[data-testid="solar-body-card"]');
    expect(card?.getAttribute('data-type')).toBe('gas');
  });

  it('tags the Moon as type=moon', () => {
    const { container } = render(
      <SolarBodyCard item={makeItem({ slug: 'moon' })} owned />,
    );
    const card = container.querySelector('[data-testid="solar-body-card"]');
    expect(card?.getAttribute('data-type')).toBe('moon');
  });

  it('shows a 🔒 corner indicator when not owned', () => {
    const { container } = render(
      <SolarBodyCard item={makeItem()} owned={false} />,
    );
    expect(container.textContent).toContain('🔒');
  });

  it('applies the owned data attribute for styling/testing', () => {
    const { container } = render(<SolarBodyCard item={makeItem()} owned />);
    const card = container.querySelector('[data-testid="solar-body-card"]');
    expect(card?.getAttribute('data-owned')).toBe('true');
  });

  it('renders the bilingual lore when size=lg and owned', () => {
    render(<SolarBodyCard item={makeItem()} owned size="lg" />);
    expect(
      screen.getByText('类型：岩石行星。我们的家，唯一有海洋的行星。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Type: Rocky planet. Our home — the only planet with oceans.',
      ),
    ).toBeInTheDocument();
  });

  it('falls back to a sparkle placeholder when item.slug is unknown', () => {
    const item = makeItem({
      slug: 'made-up',
      imageUrl: null,
      nameZh: '神秘',
      nameEn: 'Mystery',
    });
    const { container } = render(<SolarBodyCard item={item} owned />);
    expect(container.textContent).toContain('✨');
  });
});
