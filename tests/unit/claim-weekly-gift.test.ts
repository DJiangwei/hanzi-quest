import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActivityForRange: vi.fn(),
  grantGiftPackInTx: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('@/lib/db/activity', () => ({ getActivityForRange: mocks.getActivityForRange }));
vi.mock('@/lib/db/grants', async (orig) => ({
  ...(await orig<typeof import('@/lib/db/grants')>()),
  grantGiftPackInTx: mocks.grantGiftPackInTx,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { claimWeeklyGiftIfDue } from '@/lib/actions/gacha';

function activityWith(n: number) {
  return Array.from({ length: 7 }, (_, i) => ({
    dateIso: `2026-06-0${i + 1}`, played: i < n, dailyLoginBonus: i < n, freezeBurned: false, coinsEarned: 0,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
});

describe('claimWeeklyGiftIfDue', () => {
  it('returns null below threshold', async () => {
    mocks.getActivityForRange.mockResolvedValue(activityWith(4));
    const r = await claimWeeklyGiftIfDue('child-1');
    expect(r).toBeNull();
    expect(mocks.grantGiftPackInTx).not.toHaveBeenCalled();
  });

  it('grants when >= 5 check-in days', async () => {
    mocks.getActivityForRange.mockResolvedValue(activityWith(5));
    mocks.grantGiftPackInTx.mockResolvedValue({ granted: true, cards: [{ itemId: 'i1', packId: 'p1', packSlug: 'zodiac', isDupe: false, shardsAfter: 0 }] });
    const r = await claimWeeklyGiftIfDue('child-1');
    expect(r).not.toBeNull();
    expect(r?.cards).toHaveLength(1);
  });

  it('returns null when already granted this week', async () => {
    mocks.getActivityForRange.mockResolvedValue(activityWith(6));
    mocks.grantGiftPackInTx.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const r = await claimWeeklyGiftIfDue('child-1');
    expect(r).toBeNull();
  });
});
