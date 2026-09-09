import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  purchaseShopItemAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/lib/actions/shop', () => ({
  purchaseShopItemAction: mocks.purchaseShopItemAction,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: mocks.push }),
}));

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
    // Section headings are now emoji + 中文 + English in separate spans, so
    // match the parts rather than one run of text.
    expect(screen.getByText('家具')).toBeInTheDocument();
    expect(screen.getByText('/ Furniture')).toBeInTheDocument();
    expect(screen.getByText('墙饰')).toBeInTheDocument();
    // item names
    expect(screen.getByText('温馨小床')).toBeInTheDocument();
    expect(screen.getByText('Cozy Bed')).toBeInTheDocument();
    expect(screen.getByText('星空海报')).toBeInTheDocument();
  });

  it('E3 multi-buy: an owned item stays buyable until the cap, then reads 满', () => {
    const { rerender } = render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set(['shop-bed-cozy'])}
        ownedShopItemCounts={{ 'shop-bed-cozy': 1 }}
        coinBalance={500}
      />,
    );
    // The card IS the button now, and its state is on the element rather than
    // in a sentence: `再买一个 / Buy another 🪙 320` was a paragraph to read
    // twenty-five times.
    const card = screen.getByTestId('bed-cozy');
    expect(card).toBeEnabled();
    expect(card).toHaveAttribute('data-state', 'buy');
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
    const maxed = screen.getByTestId('bed-cozy');
    expect(maxed).toBeDisabled();
    expect(maxed).toHaveAttribute('data-state', 'maxed');
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

  it('sends a furniture tap to the room to be placed — it does NOT buy on the spot', async () => {
    // Buying and placing are one act now. Charging her here would take the
    // coins before she has chosen a cell, and a cell that turns out to be
    // occupied would then need a refund instead of never charging at all.
    mocks.purchaseShopItemAction.mockResolvedValue({ coinsAfter: 410 });
    render(
      <HomeTabBody
        childId="child-1"
        homeShopItems={homeShopItems}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    // The card itself is the buy target.
    const buyBtn = screen.getByTestId('poster-stars');
    await act(async () => {
      fireEvent.click(buyBtn);
    });
    expect(mocks.push).toHaveBeenCalledWith('/play/child-1/home?place=poster-stars');
    expect(
      mocks.purchaseShopItemAction,
      'the shop must not charge her before she has picked a spot',
    ).not.toHaveBeenCalled();
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

describe('the furniture shop is friendly, not chatty', () => {
  const all = [
    makeShopItem('bed-cozy', 300),
    makeShopItem('poster-stars', 90),
    makeShopItem('pirate-chest', 680),
  ];

  it('prints a price ONCE per card', () => {
    // The old card showed 🪙300 in the row and again inside the button label.
    // Scoped to one card: the component renders the whole catalog and several
    // items happen to cost 300, so a page-wide count measures the catalog, not
    // the card — the first draft of this test asserted exactly that and failed.
    render(
      <HomeTabBody childId="c" homeShopItems={all} ownedShopItemIds={new Set()} coinBalance={9999} />,
    );
    const card = screen.getByTestId('bed-cozy');
    const hits = (card.textContent ?? '').match(/300/g) ?? [];
    expect(hits).toHaveLength(1);
  });

  it('says nothing scolding when she cannot afford something', () => {
    // A shop is where a child meets "no" most often, and this product softens
    // 畏难情绪 everywhere else. The state is a grey chip, not a sentence.
    render(
      <HomeTabBody childId="c" homeShopItems={all} ownedShopItemIds={new Set()} coinBalance={0} />,
    );
    const card = screen.getByTestId('pirate-chest');
    expect(card).toHaveAttribute('data-state', 'tooExpensive');
    expect(card).toBeDisabled();
    const text = card.textContent ?? '';
    expect(text).not.toMatch(/不够|买不起|cannot|can't|afford|no money/i);
  });

  it('never shows grid-cell counts — that is developer information', () => {
    render(
      <HomeTabBody childId="c" homeShopItems={all} ownedShopItemIds={new Set()} coinBalance={9999} />,
    );
    expect(screen.queryByText(/格 \/ cell/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1×1|2×1/)).not.toBeInTheDocument();
  });

  it('keeps the whole card tappable, so there is one target not two', () => {
    render(
      <HomeTabBody childId="c" homeShopItems={all} ownedShopItemIds={new Set()} coinBalance={9999} />,
    );
    const card = screen.getByTestId('bed-cozy');
    expect(card.tagName).toBe('BUTTON');
    // and it still says what it does, for a screen reader
    expect(card).toHaveAccessibleName(/温馨小床.*300/);
  });

  it('offers the ten new items alongside the originals', () => {
    render(
      <HomeTabBody childId="c" homeShopItems={all} ownedShopItemIds={new Set()} coinBalance={9999} />,
    );
    for (const slug of ['wardrobe', 'bunk-bed', 'pirate-chest', 'map-pirate', 'globe-desk', 'yard-bench']) {
      expect(screen.getByTestId(slug), slug).toBeInTheDocument();
    }
  });
});
