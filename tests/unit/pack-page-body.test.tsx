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

import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem } from '@/lib/db/collections';

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
        balance={1000}
      />,
    );
    expect(screen.queryByRole('button', { name: /抽卡|buy a pull|gacha/i })).toBeNull();
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
        balance={1000}
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
        balance={1000}
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
        balance={500}
      />,
    );
    expect(screen.getByText(/🪙 500/)).toBeInTheDocument();
  });
});
