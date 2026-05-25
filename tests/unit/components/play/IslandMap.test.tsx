import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IslandMap } from '@/components/play/IslandMap';

describe('IslandMap view transitions', () => {
  it('island Links receive viewTransitionName style', () => {
    const { container } = render(
      <IslandMap
        childId="child_1"
        islands={[
          { weekId: 'week_a', weekNumber: 1, label: 'Week 1', completionPercent: 0 },
          { weekId: 'week_b', weekNumber: 2, label: 'Week 2', completionPercent: 50 },
        ]}
        ownedCount={0}
        totalCount={10}
      />,
    );
    const links = container.querySelectorAll('a[href^="/play/child_1/week/"]');
    expect(links.length).toBe(2);
    // jsdom serializes view-transition-name as inline style camelCase prop
    expect((links[0] as HTMLElement).style.viewTransitionName).toBe('island-week_a');
    expect((links[1] as HTMLElement).style.viewTransitionName).toBe('island-week_b');
  });
});
