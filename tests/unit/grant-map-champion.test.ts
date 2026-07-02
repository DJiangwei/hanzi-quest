import { describe, expect, it, vi, beforeEach } from 'vitest';

const { tx, transaction, insert, select } = vi.hoisted(() => {
  const tx = {
    insert: vi.fn(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({}),
        onConflictDoNothing: () => ({}),
      }),
    })),
  };
  return {
    tx,
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    insert: vi.fn<(...a: unknown[]) => unknown>(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({}),
        onConflictDoNothing: () => ({}),
      }),
    })),
    select: vi.fn(),
  };
});

vi.mock('@/db', () => ({
  db: {
    transaction,
    select: (...a: unknown[]) => select(...a),
    insert: (...a: unknown[]) => insert(...a),
  },
}));

const { grantSpecificCardInTx } = vi.hoisted(() => ({
  grantSpecificCardInTx: vi.fn(),
}));
vi.mock('@/lib/db/admin-grants', () => ({
  grantSpecificCardInTx: (...a: unknown[]) => grantSpecificCardInTx(...a),
}));

const { checkAndGrantTrophies } = vi.hoisted(() => ({
  checkAndGrantTrophies: vi.fn<(...a: unknown[]) => unknown>(async () => [
    {
      slug: 'champion-caribbean',
      nameZh: '加勒比海霸主',
      nameEn: 'Lord of the Caribbean',
      emoji: '👑',
    },
  ]),
}));
vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: (...a: unknown[]) => checkAndGrantTrophies(...a),
  MAP_TO_CHAMPION_TROPHY: { 'pirate-class-level-1': 'champion-caribbean' },
}));

import { grantMapChampionRewards } from '@/lib/db/final-boss';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grantMapChampionRewards', () => {
  it('grants the specific champion card + trophy and returns the reveal card + trophies', async () => {
    // 1) champion item lookup: select().from().innerJoin().where().limit()
    select.mockReturnValueOnce({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => [
              {
                id: 'item-1',
                slug: 'champion-caribbean',
                nameZh: '加勒比海霸主',
                nameEn: 'Lord of the Caribbean',
                loreZh: null,
                loreEn: null,
              },
            ],
          }),
        }),
      }),
    });
    // 2) cosmetic lookup: select().from().where().limit() → no row → no-op
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => [] }) }),
    });

    const res = await grantMapChampionRewards('child-1', 'pirate-class-level-1');

    expect(grantSpecificCardInTx).toHaveBeenCalledWith(tx, 'child-1', 'item-1');
    expect(checkAndGrantTrophies).toHaveBeenCalledWith('child-1', {
      kind: 'map-champion',
      packSlug: 'pirate-class-level-1',
    });
    expect(res.card?.slug).toBe('champion-caribbean');
    expect(res.trophies).toHaveLength(1);
  });
});
