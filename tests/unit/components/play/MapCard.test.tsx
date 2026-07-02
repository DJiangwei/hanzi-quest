import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));
vi.mock('@/lib/actions/maps', () => ({
  switchMapAction: vi.fn().mockResolvedValue(undefined),
}));

import { switchMapAction } from '@/lib/actions/maps';
import { MapCard } from '@/components/play/MapCard';
import type { MapForChild } from '@/lib/db/maps';

const routerPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const baseMap: MapForChild = {
  packId: 'pack_1',
  slug: 'pirate-class-level-1',
  nameZh: '加勒比海',
  nameEn: 'Caribbean Sea',
  weekCount: 10,
  clearedCount: 3,
  isCurrent: true,
  gated: false,
  isLocked: false,
};

describe('MapCard', () => {
  it('current map: renders "你正在这里 / You\'re here" badge', () => {
    render(<MapCard childId="child_1" map={baseMap} />);
    expect(screen.getByText(/你正在这里|You're here/)).toBeInTheDocument();
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText('Caribbean Sea')).toBeInTheDocument();
  });

  it('locked map: renders lock + "即将开放 / Coming soon", no switch action', () => {
    const locked = { ...baseMap, packId: 'pack_2', nameZh: '印度洋', nameEn: 'Indian Ocean', weekCount: 0, isCurrent: false, isLocked: true };
    render(<MapCard childId="child_1" map={locked} />);
    expect(screen.getByText(/即将开放|Coming soon/)).toBeInTheDocument();
    const card = screen.getByText('印度洋').closest('[data-testid="map-card"]') as HTMLElement;
    fireEvent.click(card);
    expect(switchMapAction).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('switchable map: tap calls switchMapAction then router.push(home)', async () => {
    const switchable = { ...baseMap, packId: 'pack_3', nameZh: '南太平洋', nameEn: 'South Pacific', isCurrent: false, isLocked: false };
    render(<MapCard childId="child_1" map={switchable} />);
    const card = screen.getByText('南太平洋').closest('[data-testid="map-card"]') as HTMLElement;
    fireEvent.click(card);
    await new Promise((r) => setTimeout(r, 0));
    expect(switchMapAction).toHaveBeenCalledWith('child_1', 'pack_3');
    expect(routerPush).toHaveBeenCalledWith('/play/child_1');
  });
});
