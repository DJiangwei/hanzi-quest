import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/season', () => ({
  claimSeasonTierAction: vi.fn().mockResolvedValue({ ok: true, reveals: [] }),
  claimAllSeasonTiersAction: vi.fn().mockResolvedValue({ ok: true, reveals: [] }),
}));

import { SeasonTrack } from '@/components/play/SeasonTrack';
import { claimSeasonTierAction } from '@/lib/actions/season';
import type { SeasonView } from '@/lib/season/view';

const view: SeasonView = {
  id: 's1',
  nameZh: '夏季航海',
  nameEn: 'Summer Voyage',
  themeEmoji: '⛵',
  seasonXp: 980,
  currentTier: 9,
  xpToNext: 120,
  daysRemaining: 30,
  ended: false,
  tiers: [
    { tier: 9, xpRequired: 800, reward: { type: 'coins', amount: 100 }, state: 'claimable' },
    { tier: 10, xpRequired: 950, reward: { type: 'card', cardSlug: 'season-tortoise' }, state: 'claimable' },
    { tier: 11, xpRequired: 1100, reward: { type: 'coins', amount: 150 }, state: 'locked' },
  ],
};

describe('SeasonTrack', () => {
  it('renders bilingual header + per-tier claim buttons', () => {
    render(<SeasonTrack childId="c1" view={view} />);
    expect(screen.getByText(/夏季航海/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /领取|claim/i }).length).toBeGreaterThan(0);
  });

  it('claims the first claimable tier on tap', async () => {
    render(<SeasonTrack childId="c1" view={view} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^领取 \/ Claim$/i })[0]);
    await waitFor(() => expect(claimSeasonTierAction).toHaveBeenCalledWith('c1', 9));
  });
});
