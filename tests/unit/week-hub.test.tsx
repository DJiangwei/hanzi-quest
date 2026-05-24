import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekHub } from '@/components/play/WeekHub';

const baseProps = {
  childId: 'c1',
  week: { id: 'w1', weekNumber: 5, label: '装备齐 准备出航' },
};

describe('WeekHub', () => {
  it('renders 3 section cards', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 0,  total: 10 },
          practice: { done: 0,  total: 12 },
          boss:     { done: 0,  total: 1, locked: true },
        }}
      />,
    );
    expect(screen.getByText(/回顾/)).toBeInTheDocument();
    expect(screen.getByText(/练习/)).toBeInTheDocument();
    expect(screen.getByText(/Boss/i)).toBeInTheDocument();
  });

  it('boss card shows locked copy when locked', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 10, total: 10 },
          practice: { done: 3,  total: 12 },
          boss:     { done: 0,  total: 1, locked: true },
        }}
      />,
    );
    expect(screen.getByText(/未解锁|Locked|解锁/)).toBeInTheDocument();
  });

  it('boss card is a real link when unlocked', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 10, total: 10 },
          practice: { done: 7,  total: 12 },
          boss:     { done: 0,  total: 1, locked: false },
        }}
      />,
    );
    const bossLink = screen.getByRole('link', { name: /Boss/i });
    expect(bossLink).toHaveAttribute(
      'href',
      expect.stringMatching(/\/play\/c1\/level\/w1\/boss$/),
    );
  });

  it('cleared sections show ✨ chip', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 10, total: 10 },
          practice: { done: 12, total: 12 },
          boss:     { done: 0,  total: 1, locked: false },
        }}
      />,
    );
    // At least 2 sparkle chips: review + practice
    expect(screen.getAllByText(/✨/).length).toBeGreaterThanOrEqual(2);
  });

  it('back link points to /play/[childId]', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 0, total: 10 },
          practice: { done: 0, total: 12 },
          boss:     { done: 0, total: 1, locked: true },
        }}
      />,
    );
    const back = screen.getByRole('link', { name: /航海图|back|map/i });
    expect(back).toHaveAttribute('href', '/play/c1');
  });
});
