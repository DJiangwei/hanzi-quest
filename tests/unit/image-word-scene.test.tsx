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

import { ImageWordScene } from '@/components/scenes/ImageWordScene';

const baseChar = { characterId: 'c1', hanzi: '人' };
const correctWord = {
  wordId: 'w-correct',
  text: '大人',
  imageHook: 'a smiling adult standing next to a small child',
  meaningEn: 'adult',
};
const distractors = [
  { wordId: 'w-d1', text: '主人', imageHook: null, meaningEn: 'master' },
  { wordId: 'w-d2', text: '人民', imageHook: null, meaningEn: 'people' },
  { wordId: 'w-d3', text: '老人', imageHook: null, meaningEn: 'elder' },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ImageWordScene', () => {
  it('renders the description card with imageHook text', () => {
    render(<ImageWordScene baseChar={baseChar} correctWord={correctWord} distractors={distractors} onComplete={() => {}} />);
    expect(screen.getByText(/a smiling adult/)).toBeInTheDocument();
  });

  it('renders the base 字 chip', () => {
    render(<ImageWordScene baseChar={baseChar} correctWord={correctWord} distractors={distractors} onComplete={() => {}} />);
    expect(screen.getByText('人')).toBeInTheDocument();
  });

  it('renders 4 word choices', () => {
    render(<ImageWordScene baseChar={baseChar} correctWord={correctWord} distractors={distractors} onComplete={() => {}} />);
    expect(screen.getByText('大人')).toBeInTheDocument();
    expect(screen.getByText('主人')).toBeInTheDocument();
    expect(screen.getByText('人民')).toBeInTheDocument();
    expect(screen.getByText('老人')).toBeInTheDocument();
  });

  it('clicking correct → onComplete(true) after delay', () => {
    const onComplete = vi.fn();
    render(<ImageWordScene baseChar={baseChar} correctWord={correctWord} distractors={distractors} onComplete={onComplete} />);
    const correctEl = screen.getByText('大人').closest('button');
    if (!correctEl) throw new Error('correct button not found');
    fireEvent.click(correctEl);
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('clicking distractor → onComplete(false) after delay', () => {
    const onComplete = vi.fn();
    render(<ImageWordScene baseChar={baseChar} correctWord={correctWord} distractors={distractors} onComplete={onComplete} />);
    const distractorEl = screen.getByText('主人').closest('button');
    if (!distractorEl) throw new Error('distractor button not found');
    fireEvent.click(distractorEl);
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('falls back to meaningEn when imageHook is null', () => {
    render(<ImageWordScene baseChar={baseChar} correctWord={{ ...correctWord, imageHook: null }} distractors={distractors} onComplete={() => {}} />);
    expect(screen.getByText('adult')).toBeInTheDocument();
  });
});
