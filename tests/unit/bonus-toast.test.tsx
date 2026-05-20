import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BonusToast } from '@/components/play/BonusToast';
import type { EconomyBonus } from '@/lib/actions/play';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const sample: EconomyBonus[] = [
  {
    reason: 'daily_login',
    delta: 20,
    labelZh: '今日首战！',
    labelEn: 'First play of the day!',
  },
  {
    reason: 'streak_milestone',
    delta: 100,
    labelZh: '连胜 7 天！',
    labelEn: '7-day streak!',
    meta: { milestone: 7 },
  },
];

describe('BonusToast', () => {
  it('renders nothing when bonuses is empty', () => {
    const { container } = render(<BonusToast bonuses={[]} />);
    expect(
      container.querySelector('[data-testid="bonus-toast-stack"]'),
    ).toBeNull();
  });

  it('renders one toast per bonus, each with bilingual label + delta', () => {
    render(<BonusToast bonuses={sample} />);
    expect(screen.getByText('今日首战！')).toBeInTheDocument();
    expect(screen.getByText('First play of the day!')).toBeInTheDocument();
    expect(screen.getByText('连胜 7 天！')).toBeInTheDocument();
    expect(screen.getByText('7-day streak!')).toBeInTheDocument();
    // The +N piece renders inside the same span as the Chinese label, so
    // assert that both deltas show up in the document text.
    expect(document.body.textContent).toContain('+20');
    expect(document.body.textContent).toContain('+100');
  });

  it('tags each toast with its reason for styling/testing', () => {
    const { container } = render(<BonusToast bonuses={sample} />);
    expect(
      container.querySelector('[data-testid="bonus-toast-daily_login"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="bonus-toast-streak_milestone"]'),
    ).toBeTruthy();
  });

  it('calls onDone and unmounts after durationMs', () => {
    const onDone = vi.fn();
    render(<BonusToast bonuses={sample} durationMs={1000} onDone={onDone} />);
    expect(screen.getByText('今日首战！')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('今日首战！')).not.toBeInTheDocument();
  });
});
