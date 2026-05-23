import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IslandMap } from '@/components/play/IslandMap';

const islands = [
  { weekId: 'w1', weekNumber: 1, label: 'Week 1', completionPercent: 0 },
  { weekId: 'w2', weekNumber: 2, label: 'Week 2', completionPercent: 0 },
];

describe('IslandMap decorations', () => {
  it('renders no decoration group when prop omitted', () => {
    const { container } = render(
      <IslandMap childId="c1" islands={islands} ownedCount={0} />,
    );
    expect(container.querySelector('[data-decor-slug]')).toBeNull();
  });

  it('renders one <g data-decor-slug="sailboat"> at the top-right anchor', () => {
    const { container } = render(
      <IslandMap
        childId="c1"
        islands={islands}
        ownedCount={0}
        decorations={[{ slug: 'sailboat' }]}
      />,
    );
    const node = container.querySelector('g[data-decor-slug="sailboat"]');
    expect(node).not.toBeNull();
    expect(node?.getAttribute('transform')).toMatch(/translate\(300 90\)/);
  });

  it('silently skips unknown slugs (no crash)', () => {
    const { container } = render(
      <IslandMap
        childId="c1"
        islands={islands}
        ownedCount={0}
        decorations={[{ slug: 'does-not-exist' }]}
      />,
    );
    expect(container.querySelector('[data-decor-slug="does-not-exist"]')).toBeNull();
  });

  it('renders multiple decorations', () => {
    const { container } = render(
      <IslandMap
        childId="c1"
        islands={islands}
        ownedCount={0}
        decorations={[{ slug: 'sailboat' }, { slug: 'lighthouse' }]}
      />,
    );
    expect(container.querySelectorAll('[data-decor-slug]').length).toBe(2);
  });
});
