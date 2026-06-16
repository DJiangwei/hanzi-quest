import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChildPicker } from '@/components/ChildPicker';

describe('ChildPicker', () => {
  it('renders a Play link per child', () => {
    render(
      <ChildPicker
        players={[
          { id: 'c1', displayName: 'Mei' },
          { id: 'c2', displayName: 'Bao' },
        ]}
      />,
    );
    expect(screen.getByText('Mei')).toBeInTheDocument();
    expect(screen.getByText('Bao')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/play/c1')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/play/c2')).toBe(true);
  });

  it('renders bilingual chrome heading', () => {
    render(
      <ChildPicker players={[{ id: 'c1', displayName: 'Mei' }]} />,
    );
    // ZH + EN both present (chrome rule)
    expect(screen.getByText(/选择小航海家/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a player/)).toBeInTheDocument();
  });
});
