// tests/unit/boss-kraken.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { BossKraken } from '@/components/scenes/fx/BossKraken';

describe('BossKraken', () => {
  it('renders an SVG with kraken silhouette in fighting state', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<BossKraken state="fighting" />);
    expect(container.querySelector('[data-testid="boss-kraken"]')).toBeTruthy();
    expect(container.querySelector('[data-state="fighting"]')).toBeTruthy();
  });

  it('renders winning state with red tint', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<BossKraken state="winning" />);
    expect(container.querySelector('[data-state="winning"]')).toBeTruthy();
  });

  it('reduced-motion disables tentacle animation', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(<BossKraken state="fighting" />);
    expect(container.querySelector('[data-reduced="true"]')).toBeTruthy();
  });
});
