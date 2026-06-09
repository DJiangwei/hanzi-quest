/**
 * Tests for the visible 换卡 / Trade chip on unowned cards (Card Economy v2).
 * Uses packSlug 'flags-v1' which is registered in PACK_REGISTRY.
 */
import { render, screen, fireEvent } from '@testing-library/react';
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
  convertDuplicateToShard: vi.fn().mockResolvedValue({ ok: true, count: 1, shards: 1 }),
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

describe('convert-chip: owned duplicates', () => {
  it('shows a 换碎片 chip on an owned card with count > 1', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={[{ ...items[0], count: 2, firstObtainedAt: new Date() }]}
        balance={0}
        shardCount={0}
      />,
    );
    const chips = screen.getAllByTestId('convert-chip');
    expect(chips).toHaveLength(1);
  });

  it('does NOT show a convert chip when every owned card is a single copy', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems} // count: 1
        balance={0}
        shardCount={0}
      />,
    );
    expect(screen.queryByTestId('convert-chip')).toBeNull();
  });
});

describe('shard help text', () => {
  it('shows the bilingual convert/swap explainer', () => {
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
    expect(screen.getByText(/重复的卡可以换成/)).toBeInTheDocument();
    expect(screen.getByText(/Turn duplicate cards into/)).toBeInTheDocument();
  });

  it('still shows the explainer when all items are owned (shards are universal)', () => {
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
    expect(screen.getByText(/重复的卡可以换成/)).toBeInTheDocument();
  });
});

describe('card detail tap', () => {
  it('tapping a card opens the detail dialog; tapping the swap chip does not', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems}
        balance={0}
        shardCount={5}
      />,
    );
    // Tap the owned card → detail dialog opens.
    const taps = screen.getAllByTestId('card-tap');
    fireEvent.click(taps[0]);
    expect(screen.getByTestId('card-detail-dialog')).toBeInTheDocument();
  });

  it('tapping the swap chip opens the swap flow, not the detail dialog', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['item-owned']}
        ownedItems={ownedItems}
        balance={0}
        shardCount={5}
      />,
    );
    fireEvent.click(screen.getByTestId('swap-chip'));
    expect(screen.queryByTestId('card-detail-dialog')).not.toBeInTheDocument();
  });
});
