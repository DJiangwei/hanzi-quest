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

import { SentenceClozeScene } from '@/components/scenes/SentenceClozeScene';

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
  { ...target, characterId: 'd1', hanzi: '梨', meaningEn: 'pear' },
  { ...target, characterId: 'd2', hanzi: '橙', meaningEn: 'orange' },
  { ...target, characterId: 'd3', hanzi: '桃', meaningEn: 'peach' },
];

const sentenceText = '我喜欢吃苹果。';
const translationEn = 'I love eating apples.';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SentenceClozeScene', () => {
  it('renders the sentence with the target hanzi blanked out', () => {
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={translationEn}
        onComplete={vi.fn()}
      />,
    );
    // The blanked sentence appears as one node with ____ in place of 苹.
    expect(screen.getByText(/我喜欢吃 ____ 果/)).toBeInTheDocument();
    expect(screen.getByText(translationEn)).toBeInTheDocument();
  });

  it('renders 4 hanzi options plus 1 audio button (5 total)', () => {
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={translationEn}
        onComplete={vi.fn()}
      />,
    );
    // 4 choice buttons (rendered by MultipleChoiceQuiz) + 1 audio button (in stimulus)
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('calls onComplete(true) when the correct hanzi is picked', () => {
    const onComplete = vi.fn();
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={translationEn}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText('苹'));
    // SentenceCloze now passes postRevealHoldMs=2500 to MCQ so the full
    // sentence playback isn't cut off. Advance past that.
    act(() => { vi.advanceTimersByTime(2600); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('omits the English gloss row when translationEn is null', () => {
    render(
      <SentenceClozeScene
        target={target}
        pool={pool}
        sentenceText={sentenceText}
        translationEn={null}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.queryByText(translationEn)).not.toBeInTheDocument();
  });
});
