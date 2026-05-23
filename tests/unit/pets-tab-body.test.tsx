import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  equipPetAction: vi.fn(),
  purchaseShopItemAction: vi.fn(),
}));

vi.mock('@/lib/actions/pet', () => ({ equipPetAction: mocks.equipPetAction }));
vi.mock('@/lib/actions/shop', () => ({ purchaseShopItemAction: mocks.purchaseShopItemAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PetsTabBody } from '@/components/shop/PetsTabBody';

const listings = [
  {
    shopItem: { id: 'shop-p1', slug: 'pet-parrot', kind: 'pet', name: '鹦鹉 / Parrot', description: 'desc', imageUrl: '🦜', priceCoins: 300 },
    pet: { id: 'p1', slug: 'pet-parrot', emoji: '🦜', nameZh: '鹦鹉', nameEn: 'Parrot' },
  },
  {
    shopItem: { id: 'shop-p2', slug: 'pet-crab', kind: 'pet', name: '螃蟹 / Crab', description: 'desc', imageUrl: '🦀', priceCoins: 300 },
    pet: { id: 'p2', slug: 'pet-crab', emoji: '🦀', nameZh: '螃蟹', nameEn: 'Crab' },
  },
] as any;

afterEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe('PetsTabBody', () => {
  it('renders one card per listing', () => {
    render(
      <PetsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
        equippedPetSlug={null}
      />,
    );
    expect(screen.getByText(/Parrot/)).toBeInTheDocument();
    expect(screen.getByText(/Crab/)).toBeInTheDocument();
  });

  it('marks equipped pet as 已装备', () => {
    render(
      <PetsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['shop-p1'])}
        coinBalance={500}
        equippedPetSlug="pet-parrot"
      />,
    );
    const parrot = screen.getByText(/Parrot/).closest('article')!;
    expect(parrot).toHaveTextContent(/已装备|Equipped/);
  });

  it('clicking an owned-not-equipped card calls equipPetAction', async () => {
    mocks.equipPetAction.mockResolvedValue({ petSlug: 'pet-parrot' });
    render(
      <PetsTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['shop-p1'])}
        coinBalance={500}
        equippedPetSlug={null}
      />,
    );
    const equipButton = screen.getByRole('button', { name: /装备/i });
    fireEvent.click(equipButton);
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.equipPetAction).toHaveBeenCalledWith('c1', 'pet-parrot');
  });
});
