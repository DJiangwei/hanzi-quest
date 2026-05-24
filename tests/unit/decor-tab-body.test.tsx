import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  purchaseShopItemAction: vi.fn(),
}));

vi.mock('@/lib/actions/shop', () => ({
  purchaseShopItemAction: mocks.purchaseShopItemAction,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { DecorTabBody } from '@/components/shop/DecorTabBody';
import type { DecorShopListing } from '@/lib/db/decor';

const listings: DecorShopListing[] = [
  {
    shopItem: {
      id: 's1',
      slug: 'sailboat',
      kind: 'decor',
      name: '小帆船 / Sailboat',
      description:
        '红帆小船，停泊在航海的起点。\nA red-sailed sloop bobbing near the start of your voyage.',
      imageUrl: '⛵',
      priceCoins: 200,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
    } as unknown as DecorShopListing['shopItem'],
    decoration: {
      id: 'd1',
      slug: 'sailboat',
      nameZh: '小帆船',
      nameEn: 'Sailboat',
      descriptionZh: '红帆小船',
      descriptionEn: 'A red-sailed sloop',
      emoji: '⛵',
      anchorSlug: 'top-right',
      displayOrder: 1,
      createdAt: new Date(),
    },
  },
  {
    shopItem: {
      id: 's2',
      slug: 'lighthouse',
      kind: 'decor',
      name: '灯塔 / Lighthouse',
      description: '红白相间的灯塔守望着海面。\nA red-and-white lighthouse keeping watch.',
      imageUrl: '🗼',
      priceCoins: 900,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
    } as unknown as DecorShopListing['shopItem'],
    decoration: {
      id: 'd2',
      slug: 'lighthouse',
      nameZh: '灯塔',
      nameEn: 'Lighthouse',
      descriptionZh: '',
      descriptionEn: '',
      emoji: '🗼',
      anchorSlug: 'between-6-7',
      displayOrder: 9,
      createdAt: new Date(),
    },
  },
];

describe('DecorTabBody', () => {
  it('renders one card per listing', () => {
    render(
      <DecorTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    expect(screen.getByText('小帆船')).toBeInTheDocument();
    expect(screen.getByText('Sailboat')).toBeInTheDocument();
    expect(screen.getByText('灯塔')).toBeInTheDocument();
  });

  it('owned card shows "已拥有" and disables the button', () => {
    render(
      <DecorTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['s1'])}
        coinBalance={500}
      />,
    );
    const btn = screen.getByRole('button', { name: /已拥有/ });
    expect(btn).toBeDisabled();
  });

  it('unaffordable card disables purchase button', () => {
    render(
      <DecorTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={300} // < 900 for lighthouse
      />,
    );
    // affordable sailboat (200 <= 300)
    const buyBtn = screen.getByRole('button', { name: /购买.*200/ });
    expect(buyBtn).not.toBeDisabled();
  });
});
