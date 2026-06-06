// tests/unit/gacha-weekly-gift-quest-tick.test.ts
// Task 9: Assert claimWeeklyGiftIfDue fires tickQuestProgressSafe for earn_card
// when cards are granted.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  todayUtcIso: vi.fn(() => '2026-06-06'),
  getActivityForRange: vi.fn().mockResolvedValue([]),
  mondayOfIsoWeek: vi.fn(() => '2026-06-02'),
  countCheckInDays: vi.fn().mockReturnValue(5),
  WEEKLY_CHECKIN_THRESHOLD: 5,
  grantGiftPackInTx: vi.fn().mockResolvedValue({ granted: false }),
  tickQuestProgressSafe: vi.fn().mockResolvedValue(undefined),
  dbTransaction: vi.fn(),
}));

vi.mock('@/lib/db/streaks', () => ({
  todayUtcIso: mocks.todayUtcIso,
  tickStreak: vi.fn(),
}));
vi.mock('@/lib/db/activity', () => ({
  getActivityForRange: mocks.getActivityForRange,
}));
vi.mock('@/lib/utils/iso-week', () => ({
  mondayOfIsoWeek: mocks.mondayOfIsoWeek,
}));
vi.mock('@/lib/db/checkins', () => ({
  countCheckInDays: mocks.countCheckInDays,
  WEEKLY_CHECKIN_THRESHOLD: mocks.WEEKLY_CHECKIN_THRESHOLD,
}));
vi.mock('@/lib/db/grants', () => ({
  grantGiftPackInTx: mocks.grantGiftPackInTx,
  pullCardInTx: vi.fn(),
  swapShardsInTx: vi.fn(),
}));
vi.mock('@/lib/db/quests', () => ({
  tickQuestProgressSafe: mocks.tickQuestProgressSafe,
}));
vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn((fn) => {
      const tx = {};
      return fn(tx);
    }),
  },
}));
vi.mock('@/lib/db/gacha', () => ({
  pull: vi.fn(),
  pullInTx: vi.fn(),
}));
vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: vi.fn(),
}));
vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(),
}));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: vi.fn().mockResolvedValue([]),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { claimWeeklyGiftIfDue } from '@/lib/actions/gacha';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.todayUtcIso.mockReturnValue('2026-06-06');
  mocks.mondayOfIsoWeek.mockReturnValue('2026-06-02');
  mocks.getActivityForRange.mockResolvedValue([]);
  mocks.tickQuestProgressSafe.mockResolvedValue(undefined);
});

describe('claimWeeklyGiftIfDue — earn_card quest tick (Task 9)', () => {
  it('fires tickQuestProgressSafe earn_card by cards.length when gift is granted', async () => {
    mocks.countCheckInDays.mockReturnValue(5); // threshold met
    mocks.grantGiftPackInTx.mockResolvedValue({
      granted: true,
      cards: [
        { itemId: 'i1', packSlug: 'zodiac-v1', isDupe: false, packId: 'p1' },
        { itemId: 'i2', packSlug: 'flags-v1', isDupe: false, packId: 'p2' },
        { itemId: 'i3', packSlug: 'zodiac-v1', isDupe: true, packId: 'p1' },
      ],
    });

    await claimWeeklyGiftIfDue('child-1');

    // allow void ticks to flush
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.tickQuestProgressSafe).toHaveBeenCalledWith(
      'child-1',
      'earn_card',
      3,
    );
  });

  it('does NOT fire tickQuestProgressSafe when grant is denied (not enough check-ins)', async () => {
    mocks.countCheckInDays.mockReturnValue(2); // below threshold

    const result = await claimWeeklyGiftIfDue('child-2');

    expect(result).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.tickQuestProgressSafe).not.toHaveBeenCalled();
  });

  it('does NOT fire tickQuestProgressSafe when grantGiftPackInTx returns granted=false', async () => {
    mocks.countCheckInDays.mockReturnValue(5);
    mocks.grantGiftPackInTx.mockResolvedValue({ granted: false });

    const result = await claimWeeklyGiftIfDue('child-3');

    expect(result).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.tickQuestProgressSafe).not.toHaveBeenCalled();
  });
});
