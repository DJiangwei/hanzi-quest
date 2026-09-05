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

  it('hides the boss card on a week that compiled no boss', () => {
    // Short weeks (< BOSS_MIN_CHARS chars) have no boss level, so the section
    // route notFound()s — advertising the card was a dead end.
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 8, total: 8 },
          practice: { done: 12, total: 12 },
          boss:     { done: 0, total: 0, locked: false },
        }}
      />,
    );
    expect(screen.queryByRole('link', { name: /Boss/i })).not.toBeInTheDocument();
    expect(screen.getByText(/回顾/)).toBeInTheDocument();
    expect(screen.getByText(/练习/)).toBeInTheDocument();
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

  it('names the week in hanzi, with the English digit beside it', () => {
    // Same reasoning as the voyage medallions: 一…十 are the first characters
    // map 1 teaches, and she opens a week hub every time she plays. The
    // English half keeps its digit — the rule is bilingual chrome, not
    // translated chrome, and `第三周 / Week 三` would teach nothing.
    render(
      <WeekHub
        childId="c1"
        week={{ id: 'w1', weekNumber: 3, label: '装备齐 准备出航' }}
        sections={{
          review: { done: 0, total: 10 },
          practice: { done: 0, total: 12 },
          boss: { done: 0, total: 1, locked: true },
        }}
      />,
    );
    expect(screen.getByText('第三周')).toBeInTheDocument();
    expect(screen.getByText(/Week 3/)).toBeInTheDocument();
  });
});
