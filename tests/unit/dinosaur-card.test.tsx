import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DinosaurCard } from '@/components/play/items/DinosaurCard';
import type { CollectibleItem } from '@/lib/db/collections';

function makeItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
  return {
    id: 'item-1',
    packId: 'pack-dinosaurs',
    slug: 't-rex',
    nameZh: '霸王龙',
    nameEn: 'T-Rex',
    loreZh: '时代：白垩纪。巨大的牙齿，小小的前爪。',
    loreEn: 'Era: Cretaceous. Massive teeth and tiny little arms.',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🦖',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('DinosaurCard', () => {
  it('renders both Chinese and English dinosaur names', () => {
    render(<DinosaurCard item={makeItem()} owned />);
    expect(screen.getByText('霸王龙')).toBeInTheDocument();
    expect(screen.getByText('T-Rex')).toBeInTheDocument();
  });

  it('renders the dinosaur emoji from the catalog', () => {
    const { container } = render(<DinosaurCard item={makeItem()} owned />);
    expect(container.textContent).toContain('🦖');
  });

  it('renders the bilingual era badge in default (non-compact) mode', () => {
    render(<DinosaurCard item={makeItem()} owned />);
    expect(screen.getByText('白垩纪')).toBeInTheDocument();
    expect(screen.getByText('Cretaceous')).toBeInTheDocument();
  });

  it('hides era badge when compact=true', () => {
    render(<DinosaurCard item={makeItem()} owned compact />);
    expect(screen.queryByText('白垩纪')).not.toBeInTheDocument();
  });

  it('tags the card with its era for color-coding', () => {
    const { container } = render(<DinosaurCard item={makeItem()} owned />);
    const card = container.querySelector('[data-testid="dinosaur-card"]');
    expect(card?.getAttribute('data-era')).toBe('cretaceous');
  });

  it('era-tags Jurassic dinosaurs correctly', () => {
    const { container } = render(
      <DinosaurCard item={makeItem({ slug: 'stegosaurus' })} owned />,
    );
    const card = container.querySelector('[data-testid="dinosaur-card"]');
    expect(card?.getAttribute('data-era')).toBe('jurassic');
  });

  it('shows a 🔒 corner indicator when not owned', () => {
    const { container } = render(
      <DinosaurCard item={makeItem()} owned={false} />,
    );
    expect(container.textContent).toContain('🔒');
  });

  it('applies the owned data attribute for styling/testing', () => {
    const { container } = render(<DinosaurCard item={makeItem()} owned />);
    const card = container.querySelector('[data-testid="dinosaur-card"]');
    expect(card?.getAttribute('data-owned')).toBe('true');
  });

  it('renders the bilingual lore when size=lg and owned', () => {
    render(<DinosaurCard item={makeItem()} owned size="lg" />);
    expect(
      screen.getByText('时代：白垩纪。巨大的牙齿，小小的前爪。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Era: Cretaceous. Massive teeth and tiny little arms.',
      ),
    ).toBeInTheDocument();
  });

  it('falls back to a bone placeholder when item.slug is unknown', () => {
    const item = makeItem({
      slug: 'made-up',
      imageUrl: null,
      nameZh: '神秘',
      nameEn: 'Mystery',
    });
    const { container } = render(<DinosaurCard item={item} owned />);
    expect(container.textContent).toContain('🦴');
  });
});
