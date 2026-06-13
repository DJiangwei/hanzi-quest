import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'c1' } }),
  getActiveSeason: vi.fn(),
  getSeasonXp: vi.fn().mockResolvedValue(1000),
  getSeasonProgress: vi.fn().mockResolvedValue([]),
  claimSeasonTierInTx: vi.fn().mockResolvedValue({ claimed: true, reveal: null }),
}));
vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/season', () => ({
  getActiveSeason: mocks.getActiveSeason,
  getSeasonXp: mocks.getSeasonXp,
  getSeasonProgress: mocks.getSeasonProgress,
  claimSeasonTierInTx: mocks.claimSeasonTierInTx,
}));
vi.mock('@/db', () => ({ db: { transaction: (cb: (t: unknown) => unknown) => cb({}) } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { claimSeasonTierAction } from '@/lib/actions/season';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

const season = {
  id: 's1',
  startsAt: new Date('2026-06-15'),
  endsAt: new Date('2026-08-10'),
  tierConfig: SUMMER_VOYAGE_TIERS,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveSeason.mockResolvedValue(season);
  mocks.getSeasonXp.mockResolvedValue(1000);
  mocks.getSeasonProgress.mockResolvedValue([]);
  mocks.claimSeasonTierInTx.mockResolvedValue({ claimed: true, reveal: null });
});

describe('claimSeasonTierAction', () => {
  it('claims a reached tier and returns the reveal list', async () => {
    const res = await claimSeasonTierAction('c1', 10); // tier 10 needs 950 ≤ 1000
    expect(mocks.claimSeasonTierInTx).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it('rejects an unreached tier', async () => {
    mocks.getSeasonXp.mockResolvedValue(100);
    await expect(claimSeasonTierAction('c1', 30)).rejects.toThrow();
    expect(mocks.claimSeasonTierInTx).not.toHaveBeenCalled();
  });

  it('throws when there is no active season', async () => {
    mocks.getActiveSeason.mockResolvedValue(null);
    await expect(claimSeasonTierAction('c1', 1)).rejects.toThrow();
  });
});
