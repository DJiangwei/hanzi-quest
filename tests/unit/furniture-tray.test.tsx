import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FurnitureTray } from '@/components/home/FurnitureTray';

describe('FurnitureTray', () => {
  it('labels each furniture chip bilingually (中文 + English)', () => {
    render(
      <FurnitureTray
        unplacedSlugs={['poster-stars']}
        selectedSlug={null}
        onSelect={vi.fn()}
      />,
    );
    // Both the Chinese and the English name must render (bilingual rule).
    expect(screen.getByText('星空海报')).toBeInTheDocument();
    expect(screen.getByText('Star Poster')).toBeInTheDocument();
  });

  it('shows the bilingual empty state when nothing to place', () => {
    render(
      <FurnitureTray unplacedSlugs={[]} selectedSlug={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/全部已摆放 \/ All placed/)).toBeInTheDocument();
  });
});
