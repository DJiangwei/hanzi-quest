import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShopGrid } from '@/components/shop/ShopGrid';
import type { AvatarShopListing } from '@/lib/db/shop';

function listing(
  id: string,
  slug: string,
  price: number,
  name: string,
): AvatarShopListing {
  return {
    shopItem: {
      id,
      slug,
      kind: 'avatar',
      name,
      description: null,
      imageUrl: null,
      priceCoins: price,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: { rarity: 'common', slot: 'hat' },
      createdAt: new Date(),
    },
    avatarItem: {
      id: `avatar-${id}`,
      slotId: 'hat',
      name,
      imageUrl: null,
      unlockVia: 'shop',
      unlockRef: slug,
      theme: null,
      createdAt: new Date(),
    },
  };
}

describe('ShopGrid', () => {
  const listings: AvatarShopListing[] = [
    listing('shop-tricorn', 'avatar-hat-tricorn', 120, '海盗三角帽'),
    listing('shop-bandana', 'avatar-hat-bandana-blue', 80, '蓝头巾'),
    listing('shop-crown', 'avatar-hat-crown-gold', 800, '黄金王冠'),
  ];

  it('renders an empty-state message when no listings', () => {
    render(
      <ShopGrid
        listings={[]}
        ownedShopItemIds={new Set()}
        equippedAvatarItemIds={new Set()}
        coinBalance={100}
        onPurchase={vi.fn()}
        onEquip={vi.fn()}
      />,
    );
    expect(screen.getByText(/还没有上新/)).toBeInTheDocument();
  });

  it('shows price chip for affordable items and a different chip for owned', () => {
    render(
      <ShopGrid
        listings={listings}
        ownedShopItemIds={new Set(['shop-bandana'])}
        equippedAvatarItemIds={new Set()}
        coinBalance={200}
        onPurchase={vi.fn()}
        onEquip={vi.fn()}
      />,
    );
    expect(screen.getByText('🪙 120')).toBeInTheDocument();
    expect(screen.getByText(/点击装备/)).toBeInTheDocument();
    expect(screen.getByText('🪙 800')).toBeInTheDocument();
  });

  it('marks the equipped item with ✓ 已装备 and disables its button', () => {
    render(
      <ShopGrid
        listings={listings}
        ownedShopItemIds={new Set(['shop-tricorn'])}
        equippedAvatarItemIds={new Set(['avatar-shop-tricorn'])}
        coinBalance={1000}
        onPurchase={vi.fn()}
        onEquip={vi.fn()}
      />,
    );
    expect(screen.getByText(/已装备/)).toBeInTheDocument();
    const equipped = screen.getByRole('button', {
      name: /海盗三角帽/,
    });
    expect(equipped).toBeDisabled();
  });

  it('calls onPurchase when an unowned affordable item card is tapped', () => {
    const onPurchase = vi.fn();
    render(
      <ShopGrid
        listings={listings}
        ownedShopItemIds={new Set()}
        equippedAvatarItemIds={new Set()}
        coinBalance={500}
        onPurchase={onPurchase}
        onEquip={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /蓝头巾，价格 80 金币/ }),
    );
    expect(onPurchase).toHaveBeenCalledOnce();
    expect(onPurchase.mock.calls[0][0].shopItem.slug).toBe(
      'avatar-hat-bandana-blue',
    );
  });

  it('calls onEquip when an owned card is tapped', () => {
    const onEquip = vi.fn();
    render(
      <ShopGrid
        listings={listings}
        ownedShopItemIds={new Set(['shop-bandana'])}
        equippedAvatarItemIds={new Set()}
        coinBalance={500}
        onPurchase={vi.fn()}
        onEquip={onEquip}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /蓝头巾/ }));
    expect(onEquip).toHaveBeenCalledOnce();
  });
});
