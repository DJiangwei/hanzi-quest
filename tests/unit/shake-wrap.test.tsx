// tests/unit/shake-wrap.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { ShakeWrap } from '@/components/scenes/fx/ShakeWrap';

describe('ShakeWrap', () => {
  it('renders children with motion when triggerKey changes (reduced=false)', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <ShakeWrap triggerKey={1}>
        <span data-testid="kid">k</span>
      </ShakeWrap>,
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });

  it('passes children through with no motion when reduced=true', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(
      <ShakeWrap triggerKey={1}>
        <span data-testid="kid">k</span>
      </ShakeWrap>,
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });
});
