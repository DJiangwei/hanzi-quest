// tests/unit/collection-grid.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollectionGrid } from '@/components/play/CollectionGrid';
import { ZodiacIconDefs } from '@/components/play/zodiac-icons';

describe('CollectionGrid', () => {
  it('renders 12 cards with owned-vs-locked state per slug', () => {
    const { container } = render(
      <>
        <ZodiacIconDefs />
        <CollectionGrid ownedSlugs={['rat', 'ox', 'rabbit', 'snake', 'sheep']} />
      </>,
    );
    const cards = container.querySelectorAll('[data-testid="zodiac-card"]');
    expect(cards).toHaveLength(12);
    const owned = container.querySelectorAll('[data-owned="true"]');
    expect(owned).toHaveLength(5);
  });

  it('shows the title with owned count', () => {
    render(
      <>
        <ZodiacIconDefs />
        <CollectionGrid ownedSlugs={['rat', 'ox', 'rabbit']} />
      </>,
    );
    expect(screen.getByText(/3\s*\/\s*12/)).toBeInTheDocument();
  });
});
