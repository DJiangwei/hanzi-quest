import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Kraken } from '@/components/scenes/fx/bosses/Kraken';
import type { BossAnimState } from '@/components/scenes/fx/bosses/types';

const STATES: BossAnimState[] = ['intro', 'idle', 'damage', 'defeat'];

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

describe('Kraken creature', () => {
  it('renders every state without crashing and exposes data attrs', () => {
    for (const state of STATES) {
      const { getByTestId, unmount } = render(<Kraken state={state} />);
      const el = getByTestId('boss-creature');
      expect(el).toHaveAttribute('data-state', state);
      expect(el).toHaveAttribute('data-creature', 'kraken');
      unmount();
    }
  });
});
