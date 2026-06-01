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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { swapShardsForItem } from '@/lib/actions/gacha';

beforeEach(() => {
  transactionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('swapShardsForItem', () => {
  it('returns success when DB layer succeeds', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    vi.spyOn(grantsModule, 'swapShardsInTx').mockResolvedValue({
      ok: true,
      shardsRemaining: 4,
    });

    const result = await swapShardsForItem('child-1', 'item-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shardsRemaining).toBe(4);
  });

  it('propagates insufficient_shards failure', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    vi.spyOn(grantsModule, 'swapShardsInTx').mockResolvedValue({
      ok: false,
      reason: 'insufficient_shards',
    });
    const result = await swapShardsForItem('child-1', 'item-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_shards');
  });
});
