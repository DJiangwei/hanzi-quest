// tests/unit/coin-shower.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { CoinShower } from '@/components/scenes/fx/CoinShower';

describe('CoinShower', () => {
  it('renders 5 coin elements by default when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<CoinShower />);
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(5);
  });

  it('renders count coins when count prop set', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<CoinShower count={3} />);
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(3);
  });

  it('renders nothing when reduced-motion is on', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(<CoinShower />);
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(0);
  });

  it('calls onComplete exactly once under reduced-motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const onComplete = vi.fn();
    render(<CoinShower onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
