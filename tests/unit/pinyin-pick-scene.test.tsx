import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { PinyinPickScene } from '@/components/scenes/PinyinPickScene';

const target = {
  characterId: 't1',
  hanzi: '苹',
  pinyinArray: ['píng'],
  meaningEn: 'apple',
  meaningZh: '苹果',
  imageHook: null,
  firstWord: null,
};

const pool = [
  target,
  { ...target, characterId: 'd1', hanzi: '果', pinyinArray: ['guǒ'], meaningEn: 'fruit' },
  { ...target, characterId: 'd2', hanzi: '梨', pinyinArray: ['lí'], meaningEn: 'pear' },
  { ...target, characterId: 'd3', hanzi: '橙', pinyinArray: ['chéng'], meaningEn: 'orange' },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PinyinPickScene', () => {
  it('renders the pinyin prompt and 4 hanzi options', () => {
    render(<PinyinPickScene target={target} pool={pool} onComplete={vi.fn()} />);
    expect(screen.getByText('píng')).toBeInTheDocument();
    expect(screen.getByText('苹')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('calls onComplete(true) when the correct hanzi is picked', () => {
    const onComplete = vi.fn();
    render(<PinyinPickScene target={target} pool={pool} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('苹'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('calls onComplete(false) when a distractor is picked', () => {
    const onComplete = vi.fn();
    render(<PinyinPickScene target={target} pool={pool} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('果'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('renders the full pinyin (joined by space) for multi-char pinyin arrays', () => {
    const multi = { ...target, pinyinArray: ['píng', 'guǒ'] };
    render(<PinyinPickScene target={multi} pool={pool} onComplete={vi.fn()} />);
    expect(screen.getByText('píng guǒ')).toBeInTheDocument();
  });
});
