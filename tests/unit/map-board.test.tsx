import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapBoard } from '@/components/play/MapBoard';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as object)} />;
  },
}));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));

const islands = [
  { weekId: 'w1', completionPercent: 100 },
  { weekId: 'w2', completionPercent: 40 },
];

describe('MapBoard', () => {
  it('renders one hotspot link per published week with the morph name', () => {
    render(<MapBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    const links = screen.getAllByTestId('map-hotspot-link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/play/c1/week/w1');
    expect(links[0].style.viewTransitionName).toBe('island-w1');
  });

  it('renders locked badges for landmarks beyond the published weeks', () => {
    render(<MapBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('map-hotspot-locked')).toHaveLength(8);
  });

  it('flags a cleared (100%) week', () => {
    render(<MapBoard childId="c1" packSlug="pirate-class-level-1" islands={islands} />);
    expect(screen.getAllByTestId('map-hotspot-cleared')).toHaveLength(1);
  });

  it('renders nothing for an unconfigured pack', () => {
    const { container } = render(<MapBoard childId="c1" packSlug="school-custom" islands={islands} />);
    expect(container).toBeEmptyDOMElement();
  });
});
