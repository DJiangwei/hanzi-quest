// T1 双倍宝藏 (spec 2026-07-14): frontier = lowest un-bossed week; double
// coins, double first-boss cards, visible badge + banner, quest steering.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/db', () => ({ db: {} }));

import { frontierWeekNumber } from '@/lib/db/weeks';

describe('frontierWeekNumber (pure)', () => {
  const weeks = [
    { id: 'w1', weekNumber: 1 },
    { id: 'w2', weekNumber: 2 },
    { id: 'w4', weekNumber: 4 },
  ];

  it('is the lowest un-bossed week', () => {
    expect(frontierWeekNumber(weeks, new Set(['w1']))).toBe(2);
    expect(frontierWeekNumber(weeks, new Set(['w1', 'w2']))).toBe(4);
    expect(frontierWeekNumber(weeks, new Set())).toBe(1);
  });

  it('is null when every boss is cleared (no bonus — final boss takes over)', () => {
    expect(frontierWeekNumber(weeks, new Set(['w1', 'w2', 'w4']))).toBeNull();
  });

  it('untouched weeks (no progress row) count as un-bossed', () => {
    // w4 has never been played — it still competes for the frontier.
    expect(frontierWeekNumber(weeks, new Set(['w1', 'w2']))).toBe(4);
  });
});

describe('WeekHub frontier banner', () => {
  it('shows the double-treasure banner only on the frontier week', async () => {
    const { WeekHub } = await import('@/components/play/WeekHub');
    const base = {
      childId: 'c1',
      week: { id: 'w4', weekNumber: 4, label: '第四周' },
      sections: {
        review: { done: 0, total: 10 },
        practice: { done: 0, total: 15 },
        boss: { done: 0, total: 1, locked: true },
      },
    };
    const { rerender } = render(<WeekHub {...base} frontier />);
    expect(screen.getByTestId('frontier-banner').textContent).toContain('双倍宝藏');
    rerender(<WeekHub {...base} frontier={false} />);
    expect(screen.queryByTestId('frontier-banner')).toBeNull();
  });
});

describe('VoyageBoard frontier badge', () => {
  beforeEach(() => vi.resetModules());

  it('marks 🏴 by bossCleared and puts the ✨2× badge on the first un-bossed island', async () => {
    vi.doMock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
    const { VoyageBoard } = await import('@/components/play/VoyageBoard');
    render(
      <VoyageBoard
        childId="c1"
        packSlug="pirate-class-level-1"
        islands={[
          // completionPercent 100 but boss NOT cleared — must NOT show 🏴.
          { weekId: 'w1', completionPercent: 100, bossCleared: true },
          { weekId: 'w2', completionPercent: 100, bossCleared: false },
          { weekId: 'w3', completionPercent: 0, bossCleared: false },
        ]}
      />,
    );
    expect(screen.getAllByTestId('voyage-stop-cleared')).toHaveLength(1);
    const badge = screen.getByTestId('frontier-badge');
    expect(badge.textContent).toContain('2×');
    // The badge sits on w2 (first un-bossed), not w1/w3.
    const w2 = screen.getAllByTestId('voyage-stop-link')[1];
    expect(w2.contains(badge)).toBe(true);
  });
});
