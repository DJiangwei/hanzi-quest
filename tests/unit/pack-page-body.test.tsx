import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    id: 'i1',
    packId: 'pack-flags',
    slug: 'china',
    nameZh: '中国',
    nameEn: 'China',
    loreZh: '首都：北京。大熊猫的故乡。',
    loreEn: 'Capital: Beijing. Home of the giant panda!',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🇨🇳',
    createdAt: new Date(),
  },
  {
    id: 'i2',
    packId: 'pack-flags',
    slug: 'uk',
    nameZh: '英国',
    nameEn: 'United Kingdom',
    loreZh: '首都：伦敦。有红色双层巴士。',
    loreEn: 'Capital: London. Famous for red double-decker buses.',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: '🇬🇧',
    createdAt: new Date(),
  },
];

// OwnedCollectibleItem fixtures for PR #52 shard/dupe tests
const ownedItems: OwnedCollectibleItem[] = [
  {
    ...items[0],
    count: 3,
    firstObtainedAt: new Date(),
  },
  {
    ...items[1],
    count: 1,
    firstObtainedAt: new Date(),
  },
];

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('PackPageBody gacha removal (PR #52)', () => {
  it('does NOT render "Buy a pull" CTA', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['i1']}
        ownedItems={[]}
        balance={1000}
        shardCount={0}
      />,
    );
    expect(screen.queryByRole('button', { name: /抽卡|buy a pull|gacha/i })).toBeNull();
  });
});

describe('PackPageBody PR #52 surface', () => {
  it('renders ShardPill in the header', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['i1']}
        ownedItems={ownedItems}
        balance={1000}
        shardCount={7}
      />,
    );
    expect(screen.getByText(/7/)).toBeInTheDocument();
    // Use aria-label to target ShardPill specifically; our new chip + hint also contain 🔹
    expect(screen.getByLabelText(/7 shards/i)).toBeInTheDocument();
  });

  it('renders ×N badge for items where count > 1', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['i1', 'i2']}
        ownedItems={ownedItems}
        balance={1000}
        shardCount={0}
      />,
    );
    expect(screen.getByText(/×3/)).toBeInTheDocument();
  });

  it('does NOT render ×N badge for items where count is 1', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['i1', 'i2']}
        ownedItems={ownedItems}
        balance={1000}
        shardCount={0}
      />,
    );
    expect(screen.queryByText(/×1/)).toBeNull();
  });
});

describe('PackPageBody', () => {
  it('renders bilingual pack header + slogan', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['i1']}
        ownedItems={[]}
        balance={1000}
        shardCount={0}
      />,
    );
    expect(screen.getByText('世界国旗')).toBeInTheDocument();
    expect(screen.getByText('World Flags')).toBeInTheDocument();
    expect(
      screen.getByText(/Collect flags and capitals from around the world/i),
    ).toBeInTheDocument();
  });

  it('shows pack progress (X / Y)', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['i1']}
        ownedItems={[]}
        balance={1000}
        shardCount={0}
      />,
    );
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it('shows coin balance in header', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={[]}
        ownedItems={[]}
        balance={500}
        shardCount={0}
      />,
    );
    expect(screen.getByText(/🪙 500/)).toBeInTheDocument();
  });
});
