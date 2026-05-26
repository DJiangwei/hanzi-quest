import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonthCalendar } from '@/components/play/MonthCalendar';
import type { ActivityDay } from '@/lib/db/activity';

function day(dateIso: string, overrides: Partial<ActivityDay> = {}): ActivityDay {
  return {
    dateIso,
    played: false,
    dailyLoginBonus: false,
    freezeBurned: false,
    coinsEarned: 0,
    ...overrides,
  };
}

describe('MonthCalendar', () => {
  it('renders correct number of day cells for May 2026 (31 days)', () => {
    const activity = Array.from({ length: 31 }, (_, i) =>
      day(`2026-05-${String(i + 1).padStart(2, '0')}`),
    );
    render(
      <MonthCalendar
        yyyymm="2026-05"
        activity={activity}
        todayIso="2026-05-15"
        streakDays={0}
        childId="c1"
      />,
    );
    expect(screen.getAllByTestId(/^cal-cell-/)).toHaveLength(31);
  });

  it('shows ⭐ for played days', () => {
    const activity = [day('2026-05-01', { played: true })];
    render(
      <MonthCalendar
        yyyymm="2026-05"
        activity={activity}
        todayIso="2026-05-15"
        streakDays={0}
        childId="c1"
      />,
    );
    expect(screen.getByTestId('cal-cell-2026-05-01').textContent).toContain('⭐');
  });

  it('renders prev/next month nav', () => {
    render(
      <MonthCalendar
        yyyymm="2026-05"
        activity={[]}
        todayIso="2026-05-15"
        streakDays={0}
        childId="c1"
      />,
    );
    expect(screen.getByRole('link', { name: /prev|前/i })).toHaveAttribute(
      'href',
      '/play/c1/calendar?yyyymm=2026-04',
    );
    expect(screen.getByRole('link', { name: /next|后/i })).toHaveAttribute(
      'href',
      '/play/c1/calendar?yyyymm=2026-06',
    );
  });
});
