import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { getFinalBoss } from '@/lib/scenes/final-boss-roster';

describe('final boss roster', () => {
  it('resolves the Caribbean overlord and renders each state', () => {
    const entry = getFinalBoss('pirate-class-level-1');
    expect(entry).toBeTruthy();
    expect(entry!.nameZh).toBeTruthy();
    const C = entry!.Component;
    for (const state of ['intro', 'idle', 'damage', 'defeat'] as const) {
      const { container } = render(<C state={state} size={200} />);
      expect(container.querySelector('svg')).toBeTruthy();
    }
  });
  it('returns null for a map with no overlord yet', () => {
    expect(getFinalBoss('pirate-class-level-2')).toBeNull();
  });
});
