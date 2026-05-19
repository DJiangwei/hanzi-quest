import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPackBySlug: vi.fn(),
  pull: vi.fn(),
  pullInTx: vi.fn(),
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
    transaction: vi.fn(async (fn) => fn({})),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { pullPaid } from '@/lib/actions/gacha';

beforeEach(() => {
  mocks.requireChild.mockReset();
  mocks.getPackBySlug.mockReset();
  mocks.pull.mockReset();
});

describe('pullPaid — per-pack cost from registry', () => {
  it('reads zodiac cost (500) from the registry', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-zodiac' });
    mocks.pull.mockResolvedValue({
      item: { id: 'i1' },
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

  it('reads flags cost (300) from the registry', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-flags' });
    mocks.pull.mockResolvedValue({
      item: { id: 'i1' },
      wasDuplicate: false,
      shardsAfter: null,
      coinsAfter: 700,
    });
    await pullPaid('flags-v1', { childId: 'c1' });
    expect(mocks.pull).toHaveBeenCalledWith(
      'c1',
      'pack-flags',
      expect.objectContaining({ isFree: false, costCoins: 300 }),
    );
  });

  it('throws on an unknown pack slug (no UI meta)', async () => {
    mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
    mocks.getPackBySlug.mockResolvedValue({ id: 'pack-mystery' });
    await expect(
      pullPaid('mystery-v1', { childId: 'c1' }),
    ).rejects.toThrow(/no UI meta/i);
  });
});
