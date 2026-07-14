import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/lib/hooks/use-is-wide', () => ({ useIsWide: () => false }));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/play/map-boards', () => ({
  getVoyageMap: () => ({
    nameZh: '加勒比海',
    nameEn: 'Caribbean',
    stops: [{ labelZh: '一', labelEn: 'One', emoji: '🏝️' }],
    imageUrl: null,
  }),
}));
import { VoyageBoard } from '@/components/play/VoyageBoard';

describe('VoyageBoard final-boss lair', () => {
  it('renders a locked lair node when finalBoss.unlocked is false', () => {
    render(
      <VoyageBoard
        childId="c1"
        packSlug="pirate-class-level-1"
        islands={[{ weekId: 'w1', completionPercent: 100, bossCleared: 100 >= 100 }]}
        finalBoss={{ unlocked: false, cleared: false }}
      />,
    );
    expect(screen.getByTestId('final-boss-node')).toBeInTheDocument();
    expect(screen.getByTestId('final-boss-node')).toHaveAttribute('data-state', 'locked');
  });
  it('links to the final-boss route when unlocked', () => {
    render(
      <VoyageBoard
        childId="c1"
        packSlug="pirate-class-level-1"
        islands={[{ weekId: 'w1', completionPercent: 100, bossCleared: 100 >= 100 }]}
        finalBoss={{ unlocked: true, cleared: false }}
      />,
    );
    const node = screen.getByTestId('final-boss-node');
    expect(node).toHaveAttribute('data-state', 'ready');
    expect(node.querySelector('a')).toHaveAttribute(
      'href',
      '/play/c1/final-boss/pirate-class-level-1',
    );
  });
});
