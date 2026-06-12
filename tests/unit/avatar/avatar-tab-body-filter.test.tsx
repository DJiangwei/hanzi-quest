import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Hoist mocks before module imports
const mocks = vi.hoisted(() => ({
  equipAvatarItemAction: vi.fn(),
  purchaseShopItemAction: vi.fn(),
}));

// Mock @/db to avoid DATABASE_URL requirement at import time
vi.mock('@/db', () => ({ db: {} }));

// Mock Clerk to avoid server-side auth imports
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

// Mock next/cache to avoid Next.js server-only imports
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/actions/shop', () => ({
  equipAvatarItemAction: mocks.equipAvatarItemAction,
  purchaseShopItemAction: mocks.purchaseShopItemAction,
}));

vi.mock('@/lib/actions/settings', () => ({
  equipSoundThemeAction: vi.fn(),
}));

vi.mock('@/lib/actions/pet', () => ({
  equipPetAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ShopBody } from '@/app/play/[childId]/shop/ShopBody';
import type { AvatarShopListing } from '@/lib/db/shop';

/**
 * Build a minimal AvatarShopListing. The unlockRef must match a real entry
 * in itemCatalog.tsx so that lookupItem() returns a defined theme value and
 * the filter logic is exercised end-to-end without mocking the catalog.
 *
 * 'default-bandana-red'  → theme: 'pirate'
 * 'carib-strawhat'       → theme: 'caribbean'
 */
function makeListing(
  id: string,
  slug: string,
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
      priceCoins: 100,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
    },
    avatarItem: {
      id: `av-${id}`,
      slotId: 'hat',
      name,
      imageUrl: null,
      unlockVia: 'shop',
      unlockRef: slug,
      theme: null, // DB column; theme is resolved via itemCatalog lookup
      createdAt: new Date(),
    },
  };
}

const pirateItem = makeListing('shop-1', 'default-bandana-red', 'Bandana');
const caribItem = makeListing('shop-2', 'carib-strawhat', 'Strawhat');

const baseProps = {
  childId: 'c1',
  initialCoinBalance: 1000,
  listings: [pirateItem, caribItem] as AvatarShopListing[],
  initialOwnedShopItemIds: [] as string[],
  initialEquipped: {},
  soundListings: [] as never[],
  initialEquippedSoundThemeSlug: null,
  petListings: [] as never[],
  initialEquippedPetSlug: null,
  decorListings: [] as never[],
  powerupListings: [] as never[],
  powerupCounts: { hint: 0, skip: 0, streak_freeze: 0 },
  homeShopItems: [] as never[],
  rewardCosmetics: [] as never[],
};

describe('ShopBody avatar tab filter (PR #58)', () => {
  it('renders ThemeChipStrip on the avatar tab', () => {
    render(<ShopBody {...baseProps} />);
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pirate|海盗/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Caribbean|加勒比/i })).toBeInTheDocument();
  });

  it('shows all listings when "All" chip is active (default)', () => {
    render(<ShopBody {...baseProps} />);
    expect(screen.getByText('Bandana')).toBeInTheDocument();
    expect(screen.getByText('Strawhat')).toBeInTheDocument();
  });

  it('filters to only caribbean items when Caribbean chip is selected', async () => {
    const user = userEvent.setup();
    render(<ShopBody {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /Caribbean|加勒比/i }));
    expect(screen.queryByText('Bandana')).not.toBeInTheDocument();
    expect(screen.getByText('Strawhat')).toBeInTheDocument();
  });

  it('filters to only pirate items when Pirate chip is selected', async () => {
    const user = userEvent.setup();
    render(<ShopBody {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /Pirate|海盗/i }));
    expect(screen.getByText('Bandana')).toBeInTheDocument();
    expect(screen.queryByText('Strawhat')).not.toBeInTheDocument();
  });

  it('returns to all listings when All chip is re-selected', async () => {
    const user = userEvent.setup();
    render(<ShopBody {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /Caribbean|加勒比/i }));
    await user.click(screen.getByRole('button', { name: /All/i }));
    expect(screen.getByText('Bandana')).toBeInTheDocument();
    expect(screen.getByText('Strawhat')).toBeInTheDocument();
  });
});
