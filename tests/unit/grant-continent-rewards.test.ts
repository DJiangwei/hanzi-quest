import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAndGrantTrophies: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
}));

vi.mock('@/lib/db/trophies', () => ({
  checkAndGrantTrophies: mocks.checkAndGrantTrophies,
}));
vi.mock('@/db', () => ({
  db: { select: mocks.dbSelect, insert: mocks.dbInsert },
}));

import { grantContinentRewards } from '@/lib/db/continent-rewards';

/** db.select(...).from(...).where(...).limit(1) → rows */
function avatarSelectReturns(rows: object[]) {
  mocks.dbSelect.mockReturnValue({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  });
}
function insertChain() {
  return {
    values: () => ({
      onConflictDoNothing: () => Promise.resolve(undefined),
      onConflictDoUpdate: () => Promise.resolve(undefined),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dbInsert.mockReturnValue(insertChain());
});

describe('grantContinentRewards', () => {
  it('returns the granted trophies and grants a cosmetic per newly-earned continent', async () => {
    mocks.checkAndGrantTrophies.mockResolvedValue([
      { slug: 'continent-asia', nameZh: '亚洲集齐', nameEn: 'Asia Complete', emoji: '🌏' },
    ]);
    avatarSelectReturns([{ id: 'av1', slotId: 'hat' }]);

    const res = await grantContinentRewards('c1');

    expect(res.map((t) => t.slug)).toEqual(['continent-asia']);
    expect(mocks.checkAndGrantTrophies).toHaveBeenCalledWith('c1', {
      kind: 'continent-complete',
    });
    // cosmetic granted → inventory insert + equipped upsert
    expect(mocks.dbInsert).toHaveBeenCalled();
  });

  it('returns [] and grants no cosmetic when no continent is complete', async () => {
    mocks.checkAndGrantTrophies.mockResolvedValue([]);

    const res = await grantContinentRewards('c1');

    expect(res).toEqual([]);
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });
});
