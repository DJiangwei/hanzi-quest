import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

  const onConflictMock = vi.fn().mockResolvedValue(undefined);
  const insertBalanceValuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
  const insertBalanceMock = vi.fn().mockReturnValue({ values: insertBalanceValuesMock });

  const txCounter = { count: 0 };

  return {
    insertMock,
    insertValuesMock,
    insertBalanceMock,
    insertBalanceValuesMock,
    onConflictMock,
    txCounter,
  };
});

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (fn) => {
      mocks.txCounter.count += 1;
      return fn({
        insert: vi.fn((table) => {
          const name = (table as { _: { name: string } })._?.name ?? '';
          return name === 'coin_balances' ? mocks.insertBalanceMock() : mocks.insertMock();
        }),
      });
    }),
  },
}));

import { awardCoinsInTx } from '@/lib/db/coins';

describe('awardCoinsInTx', () => {
  it('inserts a coin_transactions row and upserts coin_balances on the passed tx', async () => {
    const tx = {
      insert: vi.fn().mockImplementation(() => mocks.insertBalanceMock()),
    };
    await awardCoinsInTx(tx as never, {
      childId: 'c1',
      delta: 50,
      reason: 'scene_complete',
    });
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('skips work when delta is 0', async () => {
    const tx = { insert: vi.fn() };
    await awardCoinsInTx(tx as never, {
      childId: 'c1',
      delta: 0,
      reason: 'admin_adjust',
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
