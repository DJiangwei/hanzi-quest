import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';

const choices = [
  { key: 'a', label: <span>A</span>, isCorrect: false },
  { key: 'b', label: <span>B</span>, isCorrect: true },
  { key: 'c', label: <span>C</span>, isCorrect: false },
  { key: 'd', label: <span>D</span>, isCorrect: false },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('MultipleChoiceQuiz — hintRequested', () => {
  it('with hintRequested=true, exactly 1 wrong choice is disabled', () => {
    render(
      <MultipleChoiceQuiz
        prompt="p"
        stimulus={null}
        choices={choices}
        hintRequested
        onComplete={() => {}}
      />,
    );
    const buttons = screen.getAllByRole('button');
    const disabledButtons = buttons.filter((b) => b.hasAttribute('disabled'));
    expect(disabledButtons).toHaveLength(1);
    expect(disabledButtons[0].textContent).not.toBe('B');
  });

  it('without hintRequested, no buttons are disabled', () => {
    render(
      <MultipleChoiceQuiz
        prompt="p"
        stimulus={null}
        choices={choices}
        onComplete={() => {}}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.every((b) => !b.hasAttribute('disabled'))).toBe(true);
  });
});
