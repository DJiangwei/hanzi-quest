import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoyageBoard } from '@/components/play/VoyageBoard';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));

const islands = [
  { weekId: 'w1', completionPercent: 100, bossCleared: 100 >= 100 },
  { weekId: 'w2', completionPercent: 40, bossCleared: 40 >= 100 },
];

describe('VoyageBoard', () => {
  it('renders one medallion link per published week with the morph name', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    const links = screen.getAllByTestId('voyage-stop-link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/play/c1/week/w1');
    expect(links[0].style.viewTransitionName).toBe('island-w1');
  });

  it('numbers the stops in HANZI, not digits', () => {
    // The board shows a week number on every island, on every visit, all year.
    // 一…十 are the first characters map 1 teaches, so painting the medallions
    // in hanzi is free re-exposure — the same reasoning as A2's stale
    // distractors, applied to the chrome instead of the questions. A digit
    // here teaches nothing.
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getByText('一')).toBeInTheDocument();
    expect(screen.getByText('二')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('renders locked stops for landmarks beyond the published weeks', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('voyage-stop-locked')).toHaveLength(8); // 10 - 2
  });

  it('flags a cleared (100%) week', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('voyage-stop-cleared')).toHaveLength(1);
  });

  it('renders a gated island as a 🔒 medallion with no link (T3)', () => {
    render(
      <VoyageBoard
        childId="c1"
        packSlug="pirate-class-level-1"
        islands={[
          { weekId: 'w1', completionPercent: 100, bossCleared: true },
          { weekId: 'w2', completionPercent: 0, bossCleared: false },
          { weekId: 'w3', completionPercent: 0, bossCleared: false, locked: true },
        ]}
      />,
    );
    // w1 + w2 stay tappable; w3 is gated behind w2's boss.
    const links = screen.getAllByTestId('voyage-stop-link');
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute('href'))).not.toContain('/play/c1/week/w3');
    // A gated island is distinct from an unpublished one, and says why.
    expect(screen.getAllByTestId('voyage-stop-gated')).toHaveLength(1);
    expect(screen.getByText(/打通上一关 Boss 解锁/)).toBeInTheDocument();
    expect(screen.getByText(/Beat the boss before it/)).toBeInTheDocument();
  });

  it('spells out the first-clear rewards on the current island (T3)', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    const hint = screen.getByTestId('frontier-reward-hint');
    expect(hint).toHaveTextContent('🪙×2');
    expect(hint).toHaveTextContent('🗝️+1');
    expect(hint).toHaveTextContent(/First boss win/);
  });

  it('renders nothing for an unconfigured pack', () => {
    const { container } = render(<VoyageBoard childId="c1" packSlug="school-custom" islands={islands} />);
    expect(container).toBeEmptyDOMElement();
  });
});
