import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/db', () => ({ db: {} }));
import { EconomyDashboard } from '@/components/admin/EconomyDashboard';

const fixture = {
  coin: {
    balance: 750,
    lifetime: {
      earned: 2000,
      spent: 1250,
      byReason: [
        { key: 'scene_complete', total: 1200 },
        { key: 'shop_purchase', total: -900 },
      ],
    },
    last30: { earned: 400, spent: 100, byReason: [{ key: 'scene_complete', total: 400 }] },
    weeklyNet: Array.from({ length: 8 }, (_, i) => ({ weekStartIso: `2026-05-${11 + i}`, net: i * 10 })),
  },
  xp: { lifetime: [{ key: 'scene_complete', total: 500 }], last30: [] },
  cards: {
    daily: Array.from({ length: 14 }, (_, i) => ({ dayUtc: `2026-06-${String(10 + i)}`, count: i % 3 })),
    bySource: [{ key: 'boss_clear', total: 12 }],
    packCompletion: [{ slug: 'zodiac-v1', name: '生肖 Zodiac', owned: 6, total: 12 }],
    shards: 4,
  },
  shop: {
    byKind: [{ kind: 'avatar', owned: 10, total: 40, remainingCost: 9000 }],
    totalRemainingCost: 9000,
    balance: 750,
  },
  cap: 10,
};

describe('EconomyDashboard', () => {
  it('renders the four panels with headline numbers', () => {
    render(<EconomyDashboard {...fixture} />);
    expect(screen.getByText(/金币 Coin flow/)).toBeTruthy();
    expect(screen.getByText(/XP by source/)).toBeTruthy();
    expect(screen.getByText(/卡片 Cards/)).toBeTruthy();
    expect(screen.getByText(/商店 Shop exhaustion/)).toBeTruthy();
    expect(screen.getAllByText('750').length).toBeGreaterThan(0); // balance headline
    expect(screen.getAllByText(/scene_complete/).length).toBeGreaterThan(0);
    expect(screen.getByText(/生肖 Zodiac/)).toBeTruthy();
    expect(screen.getAllByText(/9000/).length).toBeGreaterThan(0); // remaining cost
  });

  it('flags when the balance can buy out the whole shop', () => {
    render(
      <EconomyDashboard
        {...fixture}
        shop={{ byKind: [], totalRemainingCost: 500, balance: 600 }}
      />,
    );
    expect(screen.getByText(/can buy out the whole shop/)).toBeTruthy();
  });

  it('renders cleanly with all-zero data', () => {
    render(
      <EconomyDashboard
        coin={{
          balance: 0,
          lifetime: { earned: 0, spent: 0, byReason: [] },
          last30: { earned: 0, spent: 0, byReason: [] },
          weeklyNet: [],
        }}
        xp={{ lifetime: [], last30: [] }}
        cards={{ daily: [], bySource: [], packCompletion: [], shards: 0 }}
        shop={{ byKind: [], totalRemainingCost: 0, balance: 0 }}
        cap={10}
      />,
    );
    expect(screen.getByText(/金币 Coin flow/)).toBeTruthy();
    expect(screen.getByText(/no XP yet/)).toBeTruthy();
  });
});
