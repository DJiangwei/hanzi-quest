import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPetBySlug: vi.fn(),
  setEquippedPet: vi.fn(),
  listChildOwnedShopItemIds: vi.fn(),
  listShopItemsByKind: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/pets', () => ({ getPetBySlug: mocks.getPetBySlug, setEquippedPet: mocks.setEquippedPet }));
vi.mock('@/lib/db/shop', () => ({
  listChildOwnedShopItemIds: mocks.listChildOwnedShopItemIds,
  listShopItemsByKind: mocks.listShopItemsByKind,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { equipPetAction } from '@/lib/actions/pet';

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
});

describe('equipPetAction', () => {
  it('null slug (unequip) — always allowed, sets petId = null', async () => {
    await equipPetAction('c1', null);
    expect(mocks.setEquippedPet).toHaveBeenCalledWith('c1', null);
    expect(mocks.listChildOwnedShopItemIds).not.toHaveBeenCalled();
  });

  it('rejects an unknown pet slug', async () => {
    mocks.getPetBySlug.mockResolvedValue(null);
    await expect(equipPetAction('c1', 'pet-doesnt-exist')).rejects.toThrow(/unknown pet/i);
  });

  it('rejects unowned pet', async () => {
    mocks.getPetBySlug.mockResolvedValue({ id: 'p1', slug: 'pet-parrot' });
    mocks.listShopItemsByKind.mockResolvedValue([{ id: 'shop-p1', slug: 'pet-parrot' }]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue(new Set());
    await expect(equipPetAction('c1', 'pet-parrot')).rejects.toThrow(/not owned/i);
  });

  it('accepts owned pet, calls setEquippedPet with petId', async () => {
    mocks.getPetBySlug.mockResolvedValue({ id: 'p1', slug: 'pet-parrot' });
    mocks.listShopItemsByKind.mockResolvedValue([{ id: 'shop-p1', slug: 'pet-parrot' }]);
    mocks.listChildOwnedShopItemIds.mockResolvedValue(new Set(['shop-p1']));
    const result = await equipPetAction('c1', 'pet-parrot');
    expect(mocks.setEquippedPet).toHaveBeenCalledWith('c1', 'p1');
    expect(result.petSlug).toBe('pet-parrot');
  });
});
