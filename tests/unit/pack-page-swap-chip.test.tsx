/**
 * Tests for the visible 换卡 / Trade chip on unowned cards (Card Economy v2).
 * Uses packSlug 'flags-v1' which is registered in PACK_REGISTRY.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock('@/lib/actions/gacha', () => ({
  swapShardsForItem: vi.fn().mockResolvedValue({ ok: true, shardsRemaining: 2 }),
}));

import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem, OwnedCollectibleItem } from '@/lib/db/collections';

const items: CollectibleItem[] = [
  {
    id: 'item-owned',
    packId: 'pack-flags',
    slug: 'china',
    nameZh: '中国',
    nameEn: 'China',
    loreZh: '首都：北京',
    loreEn: 'Capital: Beijing',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🇨🇳',
    createdAt: new Date(),
  },
  {
    id: 'item-unowned',
    packId: 'pack-flags',
    slug: 'uk',
    nameZh: '英国',
    nameEn: 'United Kingdom',
    loreZh: '首都：伦敦',
    loreEn: 'Capital: London',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🇬🇧',
    createdAt: new Date(),
  },
];

const ownedItems: OwnedCollectibleItem[] = [
  { ...items[0], count: 1, firstObtainedAt: new Date() },
];

afterEach(() => vi.clearAllMocks());

describe('swap-chip: with shardCount >= 3', () => {
  it('renders an enabled swap-chip on the unowned card', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems}
        balance={500}
        shardCount={3}
      />,
    );
    const chips = screen.getAllByTestId('swap-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).not.toBeDisabled();
    expect(chips[0].textContent).toMatch(/换卡|Trade/);
  });
});

describe('swap-chip: with shardCount < 3', () => {
  it('renders a disabled swap-chip showing 需 3', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems}
        balance={500}
        shardCount={1}
      />,
    );
    const chips = screen.getAllByTestId('swap-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toBeDisabled();
    expect(chips[0].textContent).toContain('需 3');
  });
});

describe('swap-chip: owned card', () => {
  it('does NOT render a swap-chip on the owned card', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems}
        balance={500}
        shardCount={5}
      />,
    );
    // Only the unowned card has a chip — owned card must not
    const chips = screen.getAllByTestId('swap-chip');
    expect(chips).toHaveLength(1); // only unowned card
  });
});

describe('swap-chip: header hint', () => {
  it('shows the bilingual hint when there is at least one unowned item', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems}
        balance={500}
        shardCount={0}
      />,
    );
    expect(
      screen.getByText(/碎片换卡片|Trade shards/),
    ).toBeInTheDocument();
  });

  it('does NOT show the hint when all items are owned', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned', 'item-unowned']}
        ownedItems={[
          ...ownedItems,
          { ...items[1], count: 1, firstObtainedAt: new Date() },
        ]}
        balance={500}
        shardCount={5}
      />,
    );
    expect(screen.queryByText(/碎片换卡片|Trade shards/)).toBeNull();
  });
});
