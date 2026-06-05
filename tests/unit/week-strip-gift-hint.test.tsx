import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekStrip } from '@/components/play/WeekStrip';

const week = Array.from({ length: 7 }, (_, i) => ({
  dateIso: `2026-06-0${i + 1}`, played: false, dailyLoginBonus: false, freezeBurned: false, coinsEarned: 0,
}));

describe('WeekStrip gift hint', () => {
  it('shows N/5 progress below the threshold', () => {
    render(<WeekStrip activity={week} todayIso="2026-06-04" childId="c1" checkInDays={3} />);
    expect(screen.getByTestId('gift-progress')).toHaveTextContent(/3\/5/);
  });
  it('shows a reached state at 5', () => {
    render(<WeekStrip activity={week} todayIso="2026-06-04" childId="c1" checkInDays={5} />);
    expect(screen.getByTestId('gift-progress')).toHaveTextContent(/大礼包|已达成|5\/5/);
  });
  it('omits the hint when checkInDays is undefined', () => {
    render(<WeekStrip activity={week} todayIso="2026-06-04" childId="c1" />);
    expect(screen.queryByTestId('gift-progress')).toBeNull();
  });
});
