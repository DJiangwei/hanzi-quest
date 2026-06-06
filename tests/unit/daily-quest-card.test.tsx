import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyQuestCard } from '@/components/play/DailyQuestCard';

describe('DailyQuestCard', () => {
  const baseProps = {
    emoji: '🧭',
    labelZh: '小小探险家',
    progress: 1,
    target: 3,
    completed: false,
  };

  it('renders the emoji and label', () => {
    render(<DailyQuestCard {...baseProps} />);
    expect(screen.getByTestId('daily-quest-card')).toHaveTextContent('🧭');
    expect(screen.getByTestId('daily-quest-card')).toHaveTextContent('小小探险家');
  });

  it('renders progress/target when not completed', () => {
    render(<DailyQuestCard {...baseProps} progress={2} target={3} />);
    expect(screen.getByTestId('daily-quest-card')).toHaveTextContent('2/3');
  });

  it('renders ✓ when completed', () => {
    render(<DailyQuestCard {...baseProps} completed={true} progress={3} />);
    expect(screen.getByTestId('quest-completed-checkmark')).toBeInTheDocument();
    expect(screen.queryByTestId('quest-progress-bar')).not.toBeInTheDocument();
  });

  it('renders progress bar in in-progress state', () => {
    render(<DailyQuestCard {...baseProps} progress={1} target={3} completed={false} />);
    const bar = screen.getByTestId('quest-progress-bar');
    expect(bar).toBeInTheDocument();
    // width should be approx 33%
    expect(bar.style.width).toMatch(/33/);
  });

  it('clamps progress bar at 100%', () => {
    render(<DailyQuestCard {...baseProps} progress={10} target={3} completed={false} />);
    const bar = screen.getByTestId('quest-progress-bar');
    expect(bar.style.width).toBe('100%');
  });

  it('does not show checkmark when not completed', () => {
    render(<DailyQuestCard {...baseProps} />);
    expect(screen.queryByTestId('quest-completed-checkmark')).not.toBeInTheDocument();
  });
});
