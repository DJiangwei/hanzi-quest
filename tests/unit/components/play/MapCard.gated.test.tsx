import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/actions/maps', () => ({
  switchMapAction: vi.fn().mockResolvedValue(undefined),
}));

import { MapCard } from '@/components/play/MapCard';

const base = {
  packId: 'p2',
  slug: 'pirate-class-level-2',
  nameZh: '印度洋',
  nameEn: 'Indian Ocean',
  weekCount: 9,
  clearedCount: 0,
  isCurrent: false,
};

describe('MapCard gated', () => {
  it('shows the overlord-gate hint when gated', () => {
    render(<MapCard childId="c1" map={{ ...base, gated: true, isLocked: true }} />);
    expect(
      screen.getByText(/先击败上一片海域的霸主|Defeat the previous overlord/),
    ).toBeInTheDocument();
  });
});
