import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({
  useCoinHud: () => ({ coinHudRef: { current: null } }),
}));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn() }));

const choices = [
  { key: 'right', label: 'right', isCorrect: true },
  { key: 'wrong', label: 'wrong', isCorrect: false },
];

describe('MultipleChoiceQuiz onResult', () => {
  it('fires once with the tapped key + correctness', () => {
    const onResult = vi.fn();
    render(
      <MultipleChoiceQuiz
        prompt="p"
        stimulus={<span>s</span>}
        choices={choices}
        onComplete={vi.fn()}
        onResult={onResult}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'wrong' }));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ pickedKey: 'wrong', correct: false });
    // one-shot: a second tap is ignored
    fireEvent.click(screen.getByRole('button', { name: 'right' }));
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('works without onResult (no crash)', () => {
    render(
      <MultipleChoiceQuiz
        prompt="p"
        stimulus={<span>s</span>}
        choices={choices}
        onComplete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'right' }));
    expect(screen.getByRole('button', { name: 'right' })).toBeTruthy();
  });
});
