import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BOSS_ROSTER } from '@/lib/scenes/boss-roster';
import type { BossAnimState } from '@/components/scenes/fx/bosses/types';

const STATES: BossAnimState[] = ['intro', 'idle', 'damage', 'defeat'];

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

describe('boss creatures (roster smoke)', () => {
  for (const entry of BOSS_ROSTER) {
    for (const state of STATES) {
      it(`${entry.key} renders state="${state}"`, () => {
        const { getByTestId } = render(<entry.Component state={state} />);
        const el = getByTestId('boss-creature');
        expect(el).toHaveAttribute('data-state', state);
        expect(el).toHaveAttribute('data-creature', entry.key);
      });
    }
  }
});

describe('boss creatures honor reduced motion', () => {
  it('renders data-reduced="true" when reduced motion is on', async () => {
    const mod = await import('@/lib/hooks/use-reduced-motion');
    vi.mocked(mod.useReducedMotion).mockReturnValue(true);
    const { Component, key } = BOSS_ROSTER[0];
    const { getByTestId } = render(<Component state="idle" />);
    expect(getByTestId('boss-creature')).toHaveAttribute('data-reduced', 'true');
    expect(getByTestId('boss-creature')).toHaveAttribute('data-creature', key);
  });
});
