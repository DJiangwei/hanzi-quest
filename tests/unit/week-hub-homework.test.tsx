import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekHub } from '@/components/play/WeekHub';

const base = {
  childId: 'c1',
  week: { id: 'w1', weekNumber: 1, label: 'Week 1' },
  sections: {
    review: { done: 0, total: 3 },
    practice: { done: 0, total: 13 },
    boss: { done: 0, total: 1, locked: true },
  },
};

describe('WeekHub homework section', () => {
  it('shows the homework card when homework is present', () => {
    render(<WeekHub {...base} homework={{ present: true, doneToday: false, count: 4 }} />);
    expect(screen.getByText('作业')).toBeInTheDocument();
  });

  it('hides the homework card when absent', () => {
    render(<WeekHub {...base} homework={{ present: false, doneToday: false, count: 0 }} />);
    expect(screen.queryByText('作业')).not.toBeInTheDocument();
  });
});
