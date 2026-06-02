// tests/unit/multiple-choice-quiz.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
}));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return {
    CoinHudContext: ctx,
    useCoinHud: () => useContext(ctx),
  };
});

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';

const choices = [
  { key: 'a', label: 'A', isCorrect: false },
  { key: 'b', label: 'B', isCorrect: true },
  { key: 'c', label: 'C', isCorrect: false },
  { key: 'd', label: 'D', isCorrect: false },
];

describe('MultipleChoiceQuiz', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(playSound).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onComplete(true) 750ms after correct pick', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onComplete = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={onComplete} />,
    );
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('plays ding on correct, buzz on wrong', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // First mount: correct pick → ding
    const { unmount } = render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(playSound).toHaveBeenCalledWith('ding');
    unmount();

    // Fresh mount (fresh state) to test wrong pick → buzz
    vi.mocked(playSound).mockReset();
    render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'A' }));
    expect(playSound).toHaveBeenCalledWith('buzz');
  });

  it('a11y: reduced-motion mounts no CoinShower DOM after correct pick', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(0);
  });

  describe('post-reveal TTS', () => {
    let cancel: ReturnType<typeof vi.fn>;
    let speakFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      cancel = vi.fn();
      speakFn = vi.fn();
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { cancel, speak: speakFn } as unknown as SpeechSynthesis,
      });
      class StubUtterance {
        text: string;
        lang = '';
        rate = 1;
        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: StubUtterance,
      });
    });

    it('speaks postRevealAudio on correct pick', async () => {
      vi.mocked(useReducedMotion).mockReturnValue(false);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <MultipleChoiceQuiz
          prompt={null}
          stimulus={null}
          choices={choices}
          onComplete={() => undefined}
          postRevealAudio="鱼"
        />,
      );
      await user.click(screen.getByRole('button', { name: 'B' }));
      expect(speakFn).toHaveBeenCalledTimes(1);
      const utt = speakFn.mock.calls[0][0] as SpeechSynthesisUtterance;
      expect(utt.text).toBe('鱼');
      expect(utt.lang).toBe('zh-CN');
    });

    it('speaks postRevealAudio on wrong pick too (so the kid still hears the right pronunciation)', async () => {
      vi.mocked(useReducedMotion).mockReturnValue(false);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <MultipleChoiceQuiz
          prompt={null}
          stimulus={null}
          choices={choices}
          onComplete={() => undefined}
          postRevealAudio="鱼"
        />,
      );
      await user.click(screen.getByRole('button', { name: 'A' }));
      expect(speakFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT speak when postRevealAudio is omitted', async () => {
      vi.mocked(useReducedMotion).mockReturnValue(false);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
      );
      await user.click(screen.getByRole('button', { name: 'B' }));
      expect(speakFn).not.toHaveBeenCalled();
    });

    it('honors postRevealHoldMs override (sentence_cloze case)', async () => {
      vi.mocked(useReducedMotion).mockReturnValue(false);
      const onComplete = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <MultipleChoiceQuiz
          prompt={null}
          stimulus={null}
          choices={choices}
          onComplete={onComplete}
          postRevealAudio="我爱大海。"
          postRevealHoldMs={2500}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'B' }));
      // 750ms hold (default) is NOT enough — onComplete must wait the full 2500ms.
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(onComplete).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onComplete).toHaveBeenCalledWith(true);
    });
  });
});
