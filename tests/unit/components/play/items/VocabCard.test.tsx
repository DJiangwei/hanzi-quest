import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransportCard } from '@/components/play/items/TransportCard';
import { AnimalCard } from '@/components/play/items/AnimalCard';
import type { CollectibleItem } from '@/lib/db/collections';

function item(slug: string, nameZh: string, nameEn: string): CollectibleItem {
  return { id: `id-${slug}`, packId: 'p', slug, nameZh, nameEn, loreZh: null, loreEn: null, rarity: 'common', dropWeight: 1, imageUrl: null, createdAt: new Date() };
}

describe('VocabCard factory', () => {
  it('renders bilingual name + a group badge when grouped (transport)', () => {
    render(<TransportCard item={item('car', '汽车', 'Car')} owned size="md" />);
    expect(screen.getByText('汽车')).toBeInTheDocument();
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('陆地')).toBeInTheDocument();
  });
  it('renders no group badge for a flat pack (animals)', () => {
    render(<AnimalCard item={item('fox', '狐狸', 'Fox')} owned size="md" />);
    expect(screen.getByText('狐狸')).toBeInTheDocument();
    expect(screen.queryByText('陆地')).not.toBeInTheDocument();
  });
  it('shows a lock on unowned', () => {
    render(<AnimalCard item={item('fox', '狐狸', 'Fox')} owned={false} size="md" />);
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });
});
