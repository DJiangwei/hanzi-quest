import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { transactionMock } = vi.hoisted(() => ({ transactionMock: vi.fn() }));

vi.mock('@/db', () => ({ db: { transaction: transactionMock } }));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (id: string) => ({ child: { id } })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { convertDuplicateToShard } from '@/lib/actions/gacha';
import { revalidatePath } from 'next/cache';

beforeEach(() => transactionMock.mockReset());
afterEach(() => vi.clearAllMocks());

describe('convertDuplicateToShard', () => {
  it('returns the new count + shard total and revalidates on success', async () => {
    transactionMock.mockResolvedValue({ ok: true, count: 1, shards: 4 });

    const result = await convertDuplicateToShard('child-1', 'item-1');

    expect(result).toEqual({ ok: true, count: 1, shards: 4 });
    expect(revalidatePath).toHaveBeenCalledWith('/play/child-1/collection');
  });

  it('propagates no_duplicate failure without revalidating', async () => {
    transactionMock.mockResolvedValue({ ok: false, reason: 'no_duplicate' });

    const result = await convertDuplicateToShard('child-1', 'item-1');

    expect(result).toEqual({ ok: false, reason: 'no_duplicate' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
