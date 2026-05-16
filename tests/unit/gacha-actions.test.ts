import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  pullInTx: vi.fn(),
  pull: vi.fn(),
  getPackBySlug: vi.fn(),
  txProgress: { bossCleared: false, freePullClaimed: false } as {
    bossCleared: boolean;
    freePullClaimed: boolean;
  },
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: mocks.requireChild,
}));

vi.mock('@/lib/db/gacha', () => ({
  pull: mocks.pull,
  pullInTx: mocks.pullInTx,
  AlreadyClaimedError: class AlreadyClaimedError extends Error {},
}));

vi.mock('@/lib/db/collections', () => ({
  getPackBySlug: mocks.getPackBySlug,
}));

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mocks.txProgress]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return fn(tx);
    }),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { pullFreeFromBoss, pullPaid } from '@/lib/actions/gacha';
import { AlreadyClaimedError } from '@/lib/errors/gacha-errors';

describe('pullFreeFromBoss', () => {
  it('throws AlreadyClaimedError when freePullClaimed is already true', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-zodiac' });
    mocks.txProgress.bossCleared = true;
    mocks.txProgress.freePullClaimed = true;
    await expect(
      pullFreeFromBoss('week-1', { childId: 'c1' }),
    ).rejects.toThrow(AlreadyClaimedError);
  });

  it('throws when bossCleared is false', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-zodiac' });
    mocks.txProgress.bossCleared = false;
    mocks.txProgress.freePullClaimed = false;
    await expect(
      pullFreeFromBoss('week-1', { childId: 'c1' }),
    ).rejects.toThrow(/boss/i);
  });

  it('successful path calls pullInTx with isFree=true', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-zodiac' });
    mocks.txProgress.bossCleared = true;
    mocks.txProgress.freePullClaimed = false;
    mocks.pullInTx.mockResolvedValue({
      item: { id: 'item-rat' },
      wasDuplicate: false,
      shardsAfter: null,
      coinsAfter: 100,
    });

    await pullFreeFromBoss('week-1', { childId: 'c1' });

    expect(mocks.pullInTx).toHaveBeenCalledWith(
      expect.anything(),
      'c1',
      expect.any(String),
      expect.objectContaining({ isFree: true, costCoins: 0 }),
    );
  });
});

describe('pullPaid', () => {
  it('throws on unknown pack slug', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue(null);
    await expect(pullPaid('unknown', { childId: 'c1' })).rejects.toThrow(
      /pack/i,
    );
  });

  it('successful path calls pull with isFree=false costCoins=500', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-zodiac' });
    mocks.pull.mockResolvedValue({
      item: { id: 'item-ox' },
      wasDuplicate: false,
      shardsAfter: null,
      coinsAfter: 500,
    });

    await pullPaid('zodiac-v1', { childId: 'c1' });

    expect(mocks.pull).toHaveBeenCalledWith(
      'c1',
      'pack-zodiac',
      expect.objectContaining({ isFree: false, costCoins: 500 }),
    );
  });
});
