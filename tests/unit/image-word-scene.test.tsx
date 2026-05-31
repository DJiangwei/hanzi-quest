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
  imageUrl: null,
};
const distractors = [
  { wordId: 'w-d1', text: '主人', imageHook: null, meaningEn: 'master', imageUrl: null },
  { wordId: 'w-d2', text: '人民', imageHook: null, meaningEn: 'people', imageUrl: null },
  { wordId: 'w-d3', text: '老人', imageHook: null, meaningEn: 'elder', imageUrl: null },
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

  it('does NOT render the standalone base hanzi chip (hidden per PR #51)', () => {
    render(<ImageWordScene baseChar={baseChar} correctWord={correctWord} distractors={distractors} onComplete={() => {}} />);
    // '人' only appears as part of word choices (大人, 主人, etc.), never as a standalone styled chip
    expect(document.querySelector('.bg-amber-200')).toBeNull();
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

  it('renders <img> with src=imageUrl when imageUrl is set', () => {
    const wordWithImage = {
      ...correctWord,
      imageUrl: 'https://blob/x.png',
    };
    render(<ImageWordScene baseChar={baseChar} correctWord={wordWithImage} distractors={distractors} onComplete={() => {}} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://blob/x.png');
  });

  it('uses imageHook as the <img> alt text when imageUrl is set', () => {
    const wordWithImage = {
      ...correctWord,
      imageUrl: 'https://blob/x.png',
    };
    render(<ImageWordScene baseChar={baseChar} correctWord={wordWithImage} distractors={distractors} onComplete={() => {}} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'a smiling adult standing next to a small child');
  });

  it('falls back to the text card when imageUrl is null', () => {
    const wordWithoutImage = {
      ...correctWord,
      imageUrl: null,
    };
    render(<ImageWordScene baseChar={baseChar} correctWord={wordWithoutImage} distractors={distractors} onComplete={() => {}} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/a smiling adult/)).toBeInTheDocument();
  });

  it('does not render the base hanzi chip in the prompt (PR #51)', () => {
    const baseChar2 = { characterId: 'b1', hanzi: '鱼' };
    const correctWord2 = {
      wordId: 'w1', text: '小鱼', imageHook: 'a small fish', meaningEn: 'small fish', imageUrl: null,
    };
    const distractors2 = [
      { wordId: 'w2', text: '金鱼', imageHook: null, meaningEn: 'goldfish', imageUrl: null },
      { wordId: 'w3', text: '鱼缸', imageHook: null, meaningEn: 'fish tank', imageUrl: null },
      { wordId: 'w4', text: '鱼网', imageHook: null, meaningEn: 'fish net', imageUrl: null },
    ];
    render(
      <ImageWordScene
        baseChar={baseChar2}
        correctWord={correctWord2}
        distractors={distractors2}
        onComplete={() => undefined}
      />,
    );
    // The prompt must NOT contain the base hanzi as a styled chip
    const promptZone = screen.queryByText(/Match the picture|看图选词/i);
    expect(promptZone).toBeInTheDocument();
    // No bg-amber-200 chip with 鱼 should exist (the old chip had this exact class set)
    const oldChip = document.querySelector('.bg-amber-200');
    expect(oldChip).toBeNull();
  });
});
