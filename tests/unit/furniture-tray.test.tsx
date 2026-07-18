import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FurnitureTray } from '@/components/home/FurnitureTray';

describe('FurnitureTray', () => {
  it('labels each furniture chip bilingually (中文 + English)', () => {
    render(
      <FurnitureTray
        items={[{ slug: 'poster-stars', count: 1 }]}
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
      <FurnitureTray items={[]} selectedSlug={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/全部已摆放 \/ All placed/)).toBeInTheDocument();
  });
});

describe('FurnitureTray — E3 multi-buy badges', () => {
  it('shows a ×N badge only when more than one spare copy exists', () => {
    const { rerender } = render(
      <FurnitureTray
        items={[{ slug: 'chair-wood', count: 2 }]}
        selectedSlug={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId('tray-count-chair-wood').textContent).toBe('×2');
    rerender(
      <FurnitureTray
        items={[{ slug: 'chair-wood', count: 1 }]}
        selectedSlug={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('tray-count-chair-wood')).toBeNull();
  });
});
