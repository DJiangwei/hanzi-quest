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
const speakMock = vi.fn();
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => speakMock }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { ImageWordScene } from '@/components/scenes/ImageWordScene';

const baseChar = { characterId: 'c1', hanzi: '人' };
const weekChars = ['人', '大', '小'];
const correctWord = {
  wordId: 'w-correct',
  text: '大人',
  imageHook: 'a smiling adult standing next to a small child',
  meaningEn: 'adult',
  imageUrl: null,
  audioUrl: 'https://blob/audio/大人.mp3',
};
const distractors = [
  { wordId: 'w-d1', text: '主人', imageHook: null, meaningEn: 'master', imageUrl: null },
  { wordId: 'w-d2', text: '人民', imageHook: null, meaningEn: 'people', imageUrl: null },
  { wordId: 'w-d3', text: '老人', imageHook: null, meaningEn: 'elder', imageUrl: null },
];

function renderScene(props: Partial<Parameters<typeof ImageWordScene>[0]> = {}) {
  return render(
    <ImageWordScene
      baseChar={baseChar}
      weekChars={weekChars}
      correctWord={correctWord}
      distractors={distractors}
      onComplete={() => {}}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ImageWordScene', () => {
  it('renders the description card with imageHook text', () => {
    renderScene();
    expect(screen.getByText(/a smiling adult/)).toBeInTheDocument();
  });

  it('does NOT render the standalone base hanzi chip (hidden per PR #51)', () => {
    renderScene();
    expect(document.querySelector('.bg-amber-200')).toBeNull();
  });

  it('renders 4 word choices (by accessible name)', () => {
    renderScene();
    expect(screen.getByRole('button', { name: /大人/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /主人/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /人民/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /老人/ })).toBeInTheDocument();
  });

  it('each option has a 🔊 that speaks the word without selecting it', () => {
    const onComplete = vi.fn();
    renderScene({ onComplete });
    fireEvent.click(screen.getByTestId('speak-大人'));
    // passes the pre-recorded clip URL (falls back to TTS inside useSpeak if absent)
    expect(speakMock).toHaveBeenCalledWith('大人', 'https://blob/audio/大人.mp3');
    // tapping 🔊 must NOT trigger a selection
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('highlights the week characters inside each option', () => {
    renderScene();
    // every '人' rendered inside an option carries the highlight color class
    const highlighted = Array.from(document.querySelectorAll('span.text-amber-600')).map(
      (n) => n.textContent,
    );
    expect(highlighted).toContain('人');
    expect(highlighted).toContain('大');
  });

  it('clicking correct → onComplete(true) after delay', () => {
    const onComplete = vi.fn();
    renderScene({ onComplete });
    fireEvent.click(screen.getByRole('button', { name: /大人/ }));
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('clicking distractor → onComplete(false) after delay', () => {
    const onComplete = vi.fn();
    renderScene({ onComplete });
    fireEvent.click(screen.getByRole('button', { name: /主人/ }));
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('falls back to meaningEn when imageHook is null', () => {
    renderScene({ correctWord: { ...correctWord, imageHook: null } });
    expect(screen.getByText('adult')).toBeInTheDocument();
  });

  it('renders <img> with src=imageUrl when imageUrl is set', () => {
    renderScene({ correctWord: { ...correctWord, imageUrl: 'https://blob/x.png' } });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://blob/x.png');
  });

  it('uses imageHook as the <img> alt text when imageUrl is set', () => {
    renderScene({ correctWord: { ...correctWord, imageUrl: 'https://blob/x.png' } });
    expect(screen.getByRole('img')).toHaveAttribute(
      'alt',
      'a smiling adult standing next to a small child',
    );
  });

  it('falls back to the text card when imageUrl is null', () => {
    renderScene({ correctWord: { ...correctWord, imageUrl: null } });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/a smiling adult/)).toBeInTheDocument();
  });
});
