import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

import { pullCardInTx, DAILY_CARD_CAP } from '@/lib/db/grants';

/** Builds a fake tx whose daily counter select returns `count`. */
function fakeTxReturningDailyCount(count: number) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn().mockResolvedValue([{ count }]),
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
  } as never;
}

describe('pullCardInTx daily cap', () => {
  it('exports DAILY_CARD_CAP = 10', () => {
    expect(DAILY_CARD_CAP).toBe(10);
  });

  it('returns daily_cap_reached when the day is already at the cap', async () => {
    const tx = fakeTxReturningDailyCount(DAILY_CARD_CAP);
    const result = await pullCardInTx(tx, 'child-1', 'boss_clear', 'ref-1', '2026-06-04');
    expect(result.granted).toBe(false);
    if (!result.granted) {
      expect(result.reason).toBe('daily_cap_reached');
      expect(result.cardsToday).toBe(DAILY_CARD_CAP);
    }
  });
});
