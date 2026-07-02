import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapsHub } from '@/components/play/MapsHub';
import type { MapForChild } from '@/lib/db/maps';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/actions/maps', () => ({
  switchMapAction: vi.fn().mockResolvedValue(undefined),
}));

describe('MapsHub', () => {
  it('renders one MapCard per map and a title', () => {
    const maps: MapForChild[] = [
      {
        packId: 'pack_1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean Sea',
        weekCount: 10, clearedCount: 3, isCurrent: true, gated: false, isLocked: false,
      },
      {
        packId: 'pack_2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian Ocean',
        weekCount: 0, clearedCount: 0, isCurrent: false, gated: false, isLocked: true,
      },
    ];
    render(<MapsHub childId="child_1" maps={maps} />);
    expect(screen.getByText(/航海图|Nautical Charts/)).toBeInTheDocument();
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText('印度洋')).toBeInTheDocument();
  });
});
