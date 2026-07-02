import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── hoisted mock setup ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  // First select chain: db.select().from(childProfiles).where().limit()
  const selectChildLimit = vi.fn();
  const selectChildWhere = vi.fn().mockReturnValue({ limit: selectChildLimit });
  const selectChildFrom = vi.fn().mockReturnValue({ where: selectChildWhere });

  // Second select chain:
  // db.select().from(curriculumPacks).leftJoin().where().groupBy().orderBy()
  const selectPackOrderBy = vi.fn();
  const selectPackGroupBy = vi.fn().mockReturnValue({ orderBy: selectPackOrderBy });
  const selectPackWhere = vi.fn().mockReturnValue({ groupBy: selectPackGroupBy });
  const selectPackLeftJoin = vi.fn().mockReturnValue({ where: selectPackWhere });
  const selectPackFrom = vi.fn().mockReturnValue({ leftJoin: selectPackLeftJoin });

  // Third select chain: listFinalBossClears → db.select().from(finalBossClears).where()
  const selectFinalBossWhere = vi.fn().mockResolvedValue([]);
  const selectFinalBossFrom = vi.fn().mockReturnValue({ where: selectFinalBossWhere });

  // update chain: db.update().set().where()
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  // select dispatcher — call 1 → child (getCurrentPackId), call 2 → pack query,
  // call 3 → final-boss-clears (listFinalBossClears).
  let selectCallCount = 0;
  const select = vi.fn().mockImplementation(() => {
    selectCallCount += 1;
    if (selectCallCount === 1) {
      return { from: selectChildFrom };
    }
    if (selectCallCount === 2) {
      return { from: selectPackFrom };
    }
    return { from: selectFinalBossFrom };
  });

  return {
    select,
    selectChildFrom,
    selectChildWhere,
    selectChildLimit,
    selectPackFrom,
    selectPackLeftJoin,
    selectPackWhere,
    selectPackGroupBy,
    selectPackOrderBy,
    selectFinalBossFrom,
    selectFinalBossWhere,
    update,
    updateSet,
    updateWhere,
    resetSelectCount: () => {
      selectCallCount = 0;
    },
  };
});

vi.mock('@/db', () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
  },
}));

import { listMapsForChild, setCurrentPackForChild } from '@/lib/db/maps';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetSelectCount();
  // Default: child has currentCurriculumPackId = 'pack_1'
  mocks.selectChildLimit.mockResolvedValue([{ packId: 'pack_1' }]);
  // Default: two public packs
  mocks.selectPackOrderBy.mockResolvedValue([
    {
      packId: 'pack_1',
      slug: 'pirate-class-level-1',
      nameZh: '加勒比海',
      nameEn: 'Caribbean Sea',
      name: 'Caribbean Sea',
      weekCount: 10,
    },
    {
      packId: 'pack_2',
      slug: 'pirate-class-level-2',
      nameZh: '印度洋',
      nameEn: 'Indian Ocean',
      name: 'Indian Ocean',
      weekCount: 0,
    },
  ]);
  mocks.updateWhere.mockResolvedValue(undefined);
});

// ── listMapsForChild ──────────────────────────────────────────────────────────

describe('listMapsForChild', () => {
  it('returns one entry per public pack with correct shape', async () => {
    const result = await listMapsForChild('child_1');

    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      packId: 'pack_1',
      slug: 'pirate-class-level-1',
      nameZh: '加勒比海',
      nameEn: 'Caribbean Sea',
      weekCount: 10,
      clearedCount: 0,
    });

    expect(result[1]).toMatchObject({
      packId: 'pack_2',
      slug: 'pirate-class-level-2',
      nameZh: '印度洋',
      nameEn: 'Indian Ocean',
      weekCount: 0,
      clearedCount: 0,
    });
  });

  it('marks pack with weekCount=0 as isLocked=true', async () => {
    const result = await listMapsForChild('child_1');

    // pack_1 has 10 weeks → not locked
    expect(result[0].isLocked).toBe(false);
    // pack_2 has 0 weeks → locked
    expect(result[1].isLocked).toBe(true);
  });

  it("marks the child's current_curriculum_pack_id pack as isCurrent=true", async () => {
    const result = await listMapsForChild('child_1');

    // pack_1 is the current pack
    expect(result[0].isCurrent).toBe(true);
    // pack_2 is not the current pack
    expect(result[1].isCurrent).toBe(false);
  });

  it('marks no pack as isCurrent when child has no currentCurriculumPackId', async () => {
    mocks.selectChildLimit.mockResolvedValueOnce([{ packId: null }]);

    const result = await listMapsForChild('child_1');

    expect(result[0].isCurrent).toBe(false);
    expect(result[1].isCurrent).toBe(false);
  });

  it('marks no pack as isCurrent when child profile not found', async () => {
    mocks.selectChildLimit.mockResolvedValueOnce([]);

    const result = await listMapsForChild('child_1');

    expect(result[0].isCurrent).toBe(false);
    expect(result[1].isCurrent).toBe(false);
  });

  it('uses name fallback when nameZh/nameEn are null (legacy school-custom pack)', async () => {
    mocks.selectPackOrderBy.mockResolvedValueOnce([
      {
        packId: 'pack_school',
        slug: 'school-custom',
        nameZh: null,
        nameEn: null,
        name: 'School Custom',
        weekCount: 5,
      },
    ]);

    const result = await listMapsForChild('child_1');

    expect(result[0].nameZh).toBe('School Custom');
    expect(result[0].nameEn).toBe('School Custom');
  });

  it('clearedCount is always 0 (deferred)', async () => {
    const result = await listMapsForChild('child_1');
    expect(result[0].clearedCount).toBe(0);
    expect(result[1].clearedCount).toBe(0);
  });
});

// ── setCurrentPackForChild ────────────────────────────────────────────────────

describe('setCurrentPackForChild', () => {
  it('updates child_profiles.currentCurriculumPackId for the given child', async () => {
    await setCurrentPackForChild('child_1', 'pack_2');

    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentCurriculumPackId: 'pack_2' }),
    );
    expect(mocks.updateWhere).toHaveBeenCalled();
  });

  it('resolves without error on success', async () => {
    await expect(
      setCurrentPackForChild('child_1', 'pack_1'),
    ).resolves.toBeUndefined();
  });
});
