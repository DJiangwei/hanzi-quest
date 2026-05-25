import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PowerupsTabBody } from '@/components/shop/PowerupsTabBody';
import type { PowerupShopListing } from '@/lib/db/powerups';

vi.mock('@/lib/actions/shop', () => ({
  purchaseShopItemAction: vi.fn().mockResolvedValue({ coinsAfter: 470, trophies: [] }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const listings = [
  {
    shopItem: {
      id: 's-hint',
      slug: 'pw-hint',
      kind: 'powerup' as const,
      name: '💡 提示 / Hint',
      description: '在多选题中划掉一个错答案。\nCross out one wrong answer.',
      imageUrl: '💡',
      priceCoins: 30,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: { powerupKind: 'hint' },
      createdAt: new Date(),
    } as unknown as PowerupShopListing['shopItem'],
  },
];

describe('PowerupsTabBody', () => {
  it('renders cards with current inventory counts', () => {
    render(
      <PowerupsTabBody
        childId="c1"
        listings={listings}
        powerupCounts={{ hint: 3, skip: 0, streak_freeze: 0 }}
        coinBalance={500}
      />,
    );
    expect(screen.getByText(/提示/)).toBeInTheDocument();
    expect(screen.getByText(/拥有.*3|Own.*3/)).toBeInTheDocument();
  });
});
