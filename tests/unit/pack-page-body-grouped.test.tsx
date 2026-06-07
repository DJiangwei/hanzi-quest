import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/actions/gacha', () => ({
  swapShardsForItem: vi.fn().mockResolvedValue({ ok: true, shardsRemaining: 2 }),
}));

import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem } from '@/lib/db/collections';

function flagItem(slug: string, nameEn: string): CollectibleItem {
  return {
    id: `id-${slug}`,
    packId: 'p',
    slug,
    nameZh: `${nameEn}-中文`,
    nameEn,
    loreZh: '',
    loreEn: '',
    rarity: 'common',
    dropWeight: 3,
    imageUrl: null,
    createdAt: new Date(),
  };
}

describe('PackPageBody grouped render', () => {
  const items = [
    flagItem('china', 'China'), // asia
    flagItem('japan', 'Japan'), // asia
    flagItem('france', 'France'), // europe
    flagItem('egypt', 'Egypt'), // africa
  ];

  it('renders a section header per non-empty continent in order', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={['id-china']}
        ownedItems={[{ ...items[0], count: 1, firstObtainedAt: new Date() }]}
        balance={0}
        shardCount={0}
      />,
    );
    // Headers are <h2>; the per-card continent badge also shows the zh name,
    // so query the heading role specifically.
    expect(screen.getByRole('heading', { name: '亚洲' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '欧洲' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '非洲' })).toBeInTheDocument();
    // Empty continents (no items) render no header:
    expect(
      screen.queryByRole('heading', { name: '大洋洲' }),
    ).not.toBeInTheDocument();
  });

  it('places each flag under its own continent section', () => {
    render(
      <PackPageBody
        childId="c1"
        packSlug="flags-v1"
        items={items}
        ownedItemIds={[]}
        ownedItems={[]}
        balance={0}
        shardCount={0}
      />,
    );
    const asia = screen.getByTestId('pack-section-asia');
    expect(within(asia).getByText('China')).toBeInTheDocument();
    expect(within(asia).getByText('Japan')).toBeInTheDocument();
    expect(within(asia).queryByText('France')).not.toBeInTheDocument();
    const europe = screen.getByTestId('pack-section-europe');
    expect(within(europe).getByText('France')).toBeInTheDocument();
  });

  it('falls back to a single flat grid when the pack has no grouping', () => {
    const zItems = [flagItem('rat', 'Rat')]; // zodiac-v1 has no grouping
    render(
      <PackPageBody
        childId="c1"
        packSlug="zodiac-v1"
        items={zItems}
        ownedItemIds={[]}
        ownedItems={[]}
        balance={0}
        shardCount={0}
      />,
    );
    expect(screen.getByTestId('pack-grid-with-badges')).toBeInTheDocument();
    expect(screen.queryByTestId('pack-section-asia')).not.toBeInTheDocument();
  });
});
