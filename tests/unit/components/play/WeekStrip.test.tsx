import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekStrip } from '@/components/play/WeekStrip';
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

describe('WeekStrip', () => {
  it('renders 7 day pills', () => {
    const activity: ActivityDay[] = [
      day('2026-05-04'),
      day('2026-05-05'),
      day('2026-05-06'),
      day('2026-05-07'),
      day('2026-05-08'),
      day('2026-05-09'),
      day('2026-05-10'),
    ];
    render(<WeekStrip activity={activity} todayIso="2026-05-07" childId="c1" />);
    expect(screen.getAllByTestId(/^week-strip-pill-/)).toHaveLength(7);
  });

  it('renders ⭐ for played days and ❄️ for freeze burns', () => {
    const activity: ActivityDay[] = [
      day('2026-05-04', { played: true }),
      day('2026-05-05', { freezeBurned: true }),
      day('2026-05-06'),
      day('2026-05-07', { played: true }),
      day('2026-05-08'),
      day('2026-05-09'),
      day('2026-05-10'),
    ];
    render(<WeekStrip activity={activity} todayIso="2026-05-07" childId="c1" />);
    expect(screen.getByText('⭐', { selector: '[data-day-iso="2026-05-04"] *' })).toBeInTheDocument();
    expect(screen.getByText('❄️', { selector: '[data-day-iso="2026-05-05"] *' })).toBeInTheDocument();
  });

  it('whole strip is a Link to /calendar', () => {
    const activity: ActivityDay[] = Array.from({ length: 7 }, (_, i) =>
      day(`2026-05-0${i + 4}`),
    );
    render(<WeekStrip activity={activity} todayIso="2026-05-07" childId="c1" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/c1/calendar');
  });
});
