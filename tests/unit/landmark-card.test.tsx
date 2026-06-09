import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandmarkCard } from '@/components/play/items/LandmarkCard';
import type { CollectibleItem } from '@/lib/db/collections';

function makeItem(overrides: Partial<CollectibleItem> = {}): CollectibleItem {
  return {
    id: 'item-1',
    packId: 'pack-landmarks',
    slug: 'eiffel-tower',
    nameZh: '埃菲尔铁塔',
    nameEn: 'Eiffel Tower',
    loreZh: '位置：法国·巴黎。用铁建造，夜晚会闪光。',
    loreEn: 'Location: Paris, France. Made of iron — it sparkles at night.',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🗼',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('LandmarkCard', () => {
  it('renders bilingual name', () => {
    render(<LandmarkCard item={makeItem()} owned />);
    expect(screen.getByText('埃菲尔铁塔')).toBeInTheDocument();
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
  });

  it('renders the location + a bilingual continent badge (non-compact)', () => {
    render(<LandmarkCard item={makeItem()} owned />);
    expect(screen.getByText(/法国·巴黎/)).toBeInTheDocument();
    expect(screen.getByText(/Paris, France/)).toBeInTheDocument();
    expect(screen.getByText('欧洲')).toBeInTheDocument();
    expect(screen.getByText('Europe')).toBeInTheDocument();
  });

  it('hides location + badge when compact', () => {
    render(<LandmarkCard item={makeItem()} owned compact />);
    expect(screen.queryByText(/法国·巴黎/)).not.toBeInTheDocument();
    expect(screen.queryByText('欧洲')).not.toBeInTheDocument();
  });

  it('shows the bilingual lore at size=lg when owned', () => {
    render(<LandmarkCard item={makeItem()} owned size="lg" />);
    expect(screen.getByText(/用铁建造/)).toBeInTheDocument();
  });

  it('shows a lock indicator when unowned', () => {
    const { container } = render(<LandmarkCard item={makeItem()} owned={false} />);
    expect(container.textContent).toContain('🔒');
  });

  it('falls back to a placeholder emoji for an unknown slug', () => {
    const { container } = render(
      <LandmarkCard item={makeItem({ slug: 'nope', imageUrl: null })} owned />,
    );
    expect(container.textContent).toContain('📍');
  });
});
