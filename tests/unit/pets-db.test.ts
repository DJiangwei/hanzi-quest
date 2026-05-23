import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectWhereLimit = vi.fn();
  const selectInnerJoinWhere = vi.fn();
  const selectFrom = vi.fn().mockReturnValue({
    where: vi.fn(() => ({ limit: selectWhereLimit })),
    innerJoin: vi.fn(() => ({ where: selectInnerJoinWhere })),
  });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const insertOnConflictUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertOnConflictUpdate });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return { select, selectFrom, selectWhereLimit, selectInnerJoinWhere, insert, insertValues, insertOnConflictUpdate };
});

vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert } }));

import { getPetBySlug, getEquippedPet, setEquippedPet, listPetShopListings } from '@/lib/db/pets';

beforeEach(() => {
  mocks.selectWhereLimit.mockReset();
  mocks.selectInnerJoinWhere.mockReset();
  mocks.insertValues.mockClear();
  mocks.insertOnConflictUpdate.mockClear();
});

describe('getPetBySlug', () => {
  it('returns the pet row if it exists', async () => {
    mocks.selectWhereLimit.mockResolvedValue([{ id: 'p1', slug: 'pet-parrot' }]);
    const row = await getPetBySlug('pet-parrot');
    expect(row?.slug).toBe('pet-parrot');
  });
  it('returns null when no row', async () => {
    mocks.selectWhereLimit.mockResolvedValue([]);
    expect(await getPetBySlug('pet-nope')).toBeNull();
  });
});

describe('getEquippedPet', () => {
  it('returns the joined pet row when equipped', async () => {
    mocks.selectInnerJoinWhere.mockResolvedValue([
      { childPetEquipped: { petId: 'p1' }, pet: { id: 'p1', slug: 'pet-parrot', emoji: '🦜', speechZh: ['加油'], speechEn: ['Keep going!'] } },
    ]);
    const result = await getEquippedPet('c1');
    expect(result?.slug).toBe('pet-parrot');
  });
  it('returns null when no equip row', async () => {
    mocks.selectInnerJoinWhere.mockResolvedValue([]);
    expect(await getEquippedPet('c1')).toBeNull();
  });
});

describe('setEquippedPet', () => {
  it('upserts with onConflictDoUpdate', async () => {
    await setEquippedPet('c1', 'p1');
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ childId: 'c1', petId: 'p1' }));
    expect(mocks.insertOnConflictUpdate).toHaveBeenCalledTimes(1);
  });
  it('upserts NULL when petId is null (unequip)', async () => {
    await setEquippedPet('c1', null);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ childId: 'c1', petId: null }));
  });
});

describe('listPetShopListings', () => {
  it('returns array of { shopItem, pet } joined by slug', async () => {
    mocks.selectInnerJoinWhere.mockResolvedValue([
      { shopItem: { id: 's1', slug: 'pet-parrot', priceCoins: 300 }, pet: { id: 'p1', slug: 'pet-parrot', emoji: '🦜' } },
    ]);
    const rows = await listPetShopListings();
    expect(rows).toHaveLength(1);
    expect(rows[0].shopItem.slug).toBe('pet-parrot');
    expect(rows[0].pet.slug).toBe('pet-parrot');
  });
});
