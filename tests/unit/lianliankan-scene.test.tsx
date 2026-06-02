import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return {
    CoinHudContext: ctx,
    useCoinHud: () => useContext(ctx),
  };
});
vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { LianliankanScene } from '@/components/scenes/LianliankanScene';

const chars = [
  { characterId: 'c1', hanzi: '鱼', meaningEn: 'fish' },
  { characterId: 'c2', hanzi: '海', meaningEn: 'sea' },
  { characterId: 'c3', hanzi: '山', meaningEn: 'mountain' },
  { characterId: 'c4', hanzi: '水', meaningEn: 'water' },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LianliankanScene', () => {
  it('renders 8 tile buttons (4 hanzi + 4 meaning)', () => {
    render(<LianliankanScene chars={chars} onComplete={() => undefined} />);
    expect(screen.getByRole('button', { name: '鱼' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '海' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sea' })).toBeInTheDocument();
  });

  it('tapping the same tile twice deselects it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LianliankanScene chars={chars} onComplete={() => undefined} />);
    const fishHanzi = screen.getByRole('button', { name: '鱼' });
    await user.click(fishHanzi);
    expect(fishHanzi.getAttribute('aria-pressed')).toBe('true');
    await user.click(fishHanzi);
    expect(fishHanzi.getAttribute('aria-pressed')).toBe('false');
  });

  it('clearing all pairs calls onComplete(true)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onComplete = vi.fn();
    render(<LianliankanScene chars={chars} onComplete={onComplete} />);

    for (const c of chars) {
      const hanziBtn = screen.getByRole('button', { name: c.hanzi });
      const meaningBtn = screen.getByRole('button', { name: c.meaningEn });
      await user.click(hanziBtn);
      await user.click(meaningBtn);
      act(() => { vi.advanceTimersByTime(700); });
    }

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('hintRequested highlights one valid pair', () => {
    const { container } = render(
      <LianliankanScene chars={chars} onComplete={() => undefined} hintRequested />,
    );
    expect(container.querySelector('[data-hint="true"]')).not.toBeNull();
  });
});
