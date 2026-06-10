import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
// Force the landscape (lg+) layout.
vi.mock('@/lib/hooks/use-is-wide', () => ({ useIsWide: () => true }));

import { VoyageBoard } from '@/components/play/VoyageBoard';

const islands = [
  { weekId: 'w1', completionPercent: 100 },
  { weekId: 'w2', completionPercent: 40 },
];

describe('VoyageBoard (landscape)', () => {
  it('renders the landscape variant (no-scroll, aspect-fit board)', () => {
    render(
      <VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />,
    );
    const board = screen.getByTestId('voyage-board');
    expect(board).toHaveAttribute('data-layout', 'landscape');
    expect(board.className).toContain('aspect-[16/10]');
    // No fixed pixel height (the vertical board would set one).
    expect(board.style.height).toBe('');
  });

  it('still renders one medallion link per published week', () => {
    render(
      <VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />,
    );
    expect(screen.getAllByTestId('voyage-stop-link')).toHaveLength(2);
  });
});
