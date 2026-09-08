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
    // Map 3 (印度洋) is reserve config with no roster entry. This used to name
    // map 2, which was true until 里海 gained the Flame Titan — a fixture that
    // silently stopped describing reality is exactly what this suite exists to
    // catch, so it must point at a map that genuinely has no overlord.
    expect(getFinalBoss('pirate-class-level-3')).toBeNull();
  });
});
