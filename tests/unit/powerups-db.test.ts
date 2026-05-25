import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));

import {
  getPowerupCounts,
  consumePowerupAtomic,
  grantStarterPowerupsIfNeeded,
  listPowerupShopListings,
} from '@/lib/db/powerups';

beforeEach(() => {
  for (const m of Object.values(dbMock)) m.mockReset();
});

describe('getPowerupCounts', () => {
  it('returns counts keyed by kind; defaults to 0 for missing rows', async () => {
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { kind: 'hint', count: 3 },
          { kind: 'skip', count: 1 },
        ]),
      }),
    });
    const counts = await getPowerupCounts('c1');
    expect(counts).toEqual({ hint: 3, skip: 1, streak_freeze: 0 });
  });

  it('returns all-zero for child with no inventory rows', async () => {
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    expect(await getPowerupCounts('c1')).toEqual({ hint: 0, skip: 0, streak_freeze: 0 });
  });
});

describe('consumePowerupAtomic', () => {
  it('returns true when UPDATE affected 1 row (count > 0)', async () => {
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }),
    });
    expect(await consumePowerupAtomic('c1', 'hint')).toBe(true);
  });

  it('returns false when UPDATE affected 0 rows (count was 0)', async () => {
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    expect(await consumePowerupAtomic('c1', 'hint')).toBe(false);
  });
});

describe('grantStarterPowerupsIfNeeded', () => {
  it('grants 1 hint + 1 skip when no inventory rows exist; returns true', async () => {
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: typeof dbMock) => Promise<unknown>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return await fn(txMock as unknown as typeof dbMock);
    });
    const granted = await grantStarterPowerupsIfNeeded('c1');
    expect(granted).toBe(true);
  });

  it('no-op when inventory has any row; returns false', async () => {
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: typeof dbMock) => Promise<unknown>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ kind: 'hint', count: 0 }]),
          }),
        }),
        insert: vi.fn(),
      };
      return await fn(txMock as unknown as typeof dbMock);
    });
    const granted = await grantStarterPowerupsIfNeeded('c1');
    expect(granted).toBe(false);
  });
});

describe('listPowerupShopListings', () => {
  it('returns active powerup shop_items wrapped in { shopItem }', async () => {
    const rows = [
      { id: 's-hint', slug: 'pw-hint', kind: 'powerup', isActive: true, name: '💡 提示 / Hint', priceCoins: 30, metadata: { powerupKind: 'hint' } },
    ];
    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });
    const out = await listPowerupShopListings();
    expect(out).toEqual([{ shopItem: rows[0] }]);
  });
});
