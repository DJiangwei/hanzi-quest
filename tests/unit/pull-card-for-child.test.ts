import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { transaction: transactionMock },
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (id: string) => ({ child: { id } })),
}));

vi.mock('@/lib/utils/iso-week', () => ({
  mondayOfIsoWeek: vi.fn(() => '2026-05-25'),
}));

vi.mock('@/lib/db/streaks', () => ({
  todayUtcIso: vi.fn(() => '2026-05-31'),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { pullCardForChild } from '@/lib/actions/gacha';

beforeEach(() => {
  transactionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('pullCardForChild', () => {
  it('returns the grant result from pullCardInTx', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    const spy = vi.spyOn(grantsModule, 'pullCardInTx').mockResolvedValue({
      granted: true,
      itemId: 'item-1',
      packId: 'pack-1',
      packSlug: 'flags',
      slug: 'flag-cn',
      nameZh: '中国',
      nameEn: 'China',
      loreZh: null,
      loreEn: null,
      isDupe: false,
      shardsAfter: 0,
      cardsToday: 1,
    });

    const result = await pullCardForChild('child-1', 'boss_clear', 'sess-1');

    expect(result.granted).toBe(true);
    if (result.granted) expect(result.itemId).toBe('item-1');
    expect(spy).toHaveBeenCalledWith({}, 'child-1', 'boss_clear', 'sess-1', '2026-05-31', Math.random);
  });

  it('returns daily_cap_reached when DB layer returns it', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    vi.spyOn(grantsModule, 'pullCardInTx').mockResolvedValue({
      granted: false,
      reason: 'daily_cap_reached',
      cardsToday: 10,
    });
    const result = await pullCardForChild('child-1', 'boss_clear', 'sess-2');
    expect(result.granted).toBe(false);
    if (!result.granted) expect(result.reason).toBe('daily_cap_reached');
  });
});
