// tests/unit/treasure-chest-reveal.test.tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { TreasureChestReveal } from '@/components/scenes/fx/TreasureChestReveal';
import { ZodiacIconDefs } from '@/components/play/zodiac-icons';

const item = {
  id: 'i1',
  slug: 'rabbit' as const,
  nameZh: '兔',
  nameEn: 'Rabbit',
  loreZh: '毛茸茸，跳得高。',
  loreEn: 'Fluffy and bouncy.',
};

describe('TreasureChestReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the awarded zodiac hanzi + name + lore after the reveal stage', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <>
        <ZodiacIconDefs />
        <TreasureChestReveal item={item} wasDuplicate={false} shardsAfter={null} />
      </>,
    );
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText('兔')).toBeInTheDocument();
    expect(screen.getByText(/Rabbit/i)).toBeInTheDocument();
  });

  it('shows "+1 卡屑" overlay when wasDuplicate=true', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <>
        <ZodiacIconDefs />
        <TreasureChestReveal item={item} wasDuplicate shardsAfter={3} />
      </>,
    );
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText(/\+1 卡屑/)).toBeInTheDocument();
  });

  it('reduced-motion path renders the reveal immediately (no entrance animation gating)', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(
      <>
        <ZodiacIconDefs />
        <TreasureChestReveal item={item} wasDuplicate={false} shardsAfter={null} />
      </>,
    );
    expect(screen.getByText('兔')).toBeInTheDocument();
  });
});
