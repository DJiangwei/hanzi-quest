import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}));

import { SailingShip } from '@/components/play/SailingShip';

const points = [
  { xPct: 12, yPct: 32 },
  { xPct: 50, yPct: 32 },
  { xPct: 88, yPct: 70 },
];

describe('SailingShip', () => {
  it('parks a static ship at the current stop under reduced-motion', () => {
    render(<SailingShip points={points} currentIndex={1} />);
    const ship = screen.getByTestId('sailing-ship');
    expect(ship).toHaveTextContent('⛵');
    // Parked at points[1] = (50, 32).
    expect(ship.style.left).toBe('50%');
    expect(ship.style.top).toBe('32%');
  });

  it('clamps an out-of-range currentIndex to the last stop', () => {
    render(<SailingShip points={points} currentIndex={99} />);
    const ship = screen.getByTestId('sailing-ship');
    expect(ship.style.left).toBe('88%');
  });

  it('renders nothing with no points', () => {
    const { container } = render(<SailingShip points={[]} currentIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
