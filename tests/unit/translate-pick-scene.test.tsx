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

import { TranslatePickScene } from '@/components/scenes/TranslatePickScene';

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
  { ...target, characterId: 'd1', hanzi: '梨', meaningEn: 'pear', meaningZh: '梨' },
  { ...target, characterId: 'd2', hanzi: '橙', meaningEn: 'orange', meaningZh: '橙' },
  { ...target, characterId: 'd3', hanzi: '桃', meaningEn: 'peach', meaningZh: '桃' },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('TranslatePickScene — CN to EN', () => {
  it('renders the hanzi prompt and 4 English options', () => {
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="cn_to_en"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByText('苹')).toBeInTheDocument();
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('pear')).toBeInTheDocument();
  });

  it('calls onComplete(true) when the correct English meaning is picked', () => {
    const onComplete = vi.fn();
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="cn_to_en"
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText('apple'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });
});

describe('TranslatePickScene — EN to CN', () => {
  it('renders the English prompt and 4 hanzi options', () => {
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="en_to_cn"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByText(/apple/i)).toBeInTheDocument();
    expect(screen.getByText('苹')).toBeInTheDocument();
    expect(screen.getByText('梨')).toBeInTheDocument();
  });

  it('calls onComplete(true) when the correct hanzi is picked', () => {
    const onComplete = vi.fn();
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="en_to_cn"
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText('苹'));
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });
});

describe('TranslatePickScene — SpeakButton (PR #50)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
    });
    class StubUtterance {
      text: string;
      lang = '';
      rate = 1;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: StubUtterance,
    });
  });

  it('renders a SpeakButton next to the hanzi stimulus in cn_to_en direction', () => {
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="cn_to_en"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /read aloud|play sound/i })).toBeInTheDocument();
  });

  it('does NOT render a SpeakButton in en_to_cn direction (would reveal answer)', () => {
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="en_to_cn"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /read aloud|play sound/i })).toBeNull();
  });
});
