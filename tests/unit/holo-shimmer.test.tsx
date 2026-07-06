import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoloShimmer, isLimitedPack } from '@/components/play/items/HoloShimmer';

describe('isLimitedPack', () => {
  it('is true exactly for the shard-exclusive (reward-only) packs', () => {
    expect(isLimitedPack('festivals-v1')).toBe(true);
    expect(isLimitedPack('season-summer-v1')).toBe(true);
    expect(isLimitedPack('champions-v1')).toBe(true);
    expect(isLimitedPack('flags-v1')).toBe(false);
    expect(isLimitedPack('zodiac-v1')).toBe(false);
  });
});

describe('HoloShimmer', () => {
  it('renders the sheen overlay when active', () => {
    render(
      <HoloShimmer active>
        <span>card</span>
      </HoloShimmer>,
    );
    expect(screen.getByTestId('holo-overlay')).toBeTruthy();
    expect(screen.getByText('card')).toBeTruthy();
  });

  it('renders children untouched when inactive', () => {
    render(
      <HoloShimmer active={false}>
        <span>card</span>
      </HoloShimmer>,
    );
    expect(screen.queryByTestId('holo-overlay')).toBeNull();
    expect(screen.getByText('card')).toBeTruthy();
  });
});
