import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  purchaseShopItemAction: vi.fn(),
}));

vi.mock('@/lib/actions/shop', () => ({
  purchaseShopItemAction: mocks.purchaseShopItemAction,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { HomeTabBody } from '@/components/shop/HomeTabBody';
import type { ShopItemRow } from '@/lib/db/shop';
import { FURNITURE_CATALOG } from '@/lib/home/furniture-catalog';

// Build shop item rows matching the first few catalog entries
function makeShopItem(slug: string, priceCoins: number): ShopItemRow {
  return {
    id: `shop-${slug}`,
    slug,
    kind: 'home',
    name: FURNITURE_CATALOG.find((f) => f.slug === slug)?.nameZh ?? slug,
    description: null,
    imageUrl: null,
    priceCoins,
    availableFrom: null,
    availableTo: null,
    isActive: true,
    metadata: { rarity: 'common', category: 'furniture' },
    createdAt: new Date(),
  } as unknown as ShopItemRow;
}

const homeShopItems: ShopItemRow[] = [
  makeShopItem('bed-cozy', 300),
  makeShopItem('poster-stars', 90),
  makeShopItem('rug-round', 100),
];

describe('HomeTabBody', () => {
  it('renders catalog items grouped by category', () => {
    render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    // furniture group header
    expect(screen.getByText(/家具.*Furniture/i)).toBeInTheDocument();
    // wall_art group header
    expect(screen.getByText(/墙饰.*Wall Art/i)).toBeInTheDocument();
    // item names
    expect(screen.getByText('温馨小床')).toBeInTheDocument();
    expect(screen.getByText('Cozy Bed')).toBeInTheDocument();
    expect(screen.getByText('星空海报')).toBeInTheDocument();
  });

  it('E3 multi-buy: an owned item offers 再买一个 until the cap, then 已满 disables', () => {
    const { rerender } = render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set(['shop-bed-cozy'])}
        ownedShopItemCounts={{ 'shop-bed-cozy': 1 }}
        coinBalance={500}
      />,
    );
    const buyAgain = screen.getByRole('button', { name: /再买一个/i });
    expect(buyAgain).toBeEnabled();
    expect(screen.getByTestId('owned-count-bed-cozy').textContent).toContain('×1');

    rerender(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set(['shop-bed-cozy'])}
        ownedShopItemCounts={{ 'shop-bed-cozy': 3 }}
        coinBalance={500}
      />,
    );
    const maxed = screen.getByRole('button', { name: /已满/i });
    expect(maxed).toBeDisabled();
  });

  it('disables buy button when balance is insufficient', () => {
    render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set()}
        coinBalance={50} // less than cheapest (90)
      />,
    );
    const btns = screen.getAllByRole('button');
    btns.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('calls purchaseShopItemAction when buy button is clicked', async () => {
    mocks.purchaseShopItemAction.mockResolvedValue({ coinsAfter: 410 });
    render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    // find buy button for poster-stars (90 coins)
    const buyBtn = screen.getByRole('button', { name: /购买.*90/ });
    await act(async () => {
      fireEvent.click(buyBtn);
    });
    expect(mocks.purchaseShopItemAction).toHaveBeenCalledWith(
      'shop-poster-stars',
      { childId: 'child-1' },
    );
  });

  it('renders SVG previews for each item with a shop_items row', () => {
    render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    // SVGs should be present (one per catalog item that has a shop row)
    const svgs = document.querySelectorAll('svg');
    // At least 3 SVG previews (one per homeShopItems entry)
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });

  it('shows 即将上线 placeholder for catalog items with no shop row', () => {
    // Only supply shop item for poster-stars; bed-cozy and rug-round have no row
    render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={[makeShopItem('poster-stars', 90)]}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    // bed-cozy should show placeholder
    expect(screen.getByText('温馨小床')).toBeInTheDocument();
    const placeholderBtns = screen.getAllByRole('button', { name: /即将上线/ });
    expect(placeholderBtns.length).toBeGreaterThan(0);
  });
});
