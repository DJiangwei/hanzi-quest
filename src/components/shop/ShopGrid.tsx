'use client';

import type { AvatarShopListing } from '@/lib/db/shop';
import { ShopItemCard, type ItemCardState } from './ShopItemCard';

interface Props {
  listings: AvatarShopListing[];
  ownedShopItemIds: Set<string>;
  equippedAvatarItemIds: Set<string>;
  coinBalance: number;
  /** The shop item currently being tried on (gets a "trying" badge). */
  tryingShopItemId?: string | null;
  onPurchase: (listing: AvatarShopListing) => void;
  onEquip: (listing: AvatarShopListing) => void;
}

export function ShopGrid({
  listings,
  ownedShopItemIds,
  equippedAvatarItemIds,
  coinBalance,
  tryingShopItemId = null,
  onPurchase,
  onEquip,
}: Props) {
  if (listings.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-amber-900/70">
        商店还没有上新，请稍后再来。/ Nothing new yet — check back soon.
      </div>
    );
  }

  return (
    <ul
      className="grid grid-cols-2 gap-3 px-3 py-4 sm:grid-cols-3 md:grid-cols-4"
      data-testid="shop-grid"
    >
      {listings.map((listing) => {
        const owned = ownedShopItemIds.has(listing.shopItem.id);
        const equipped = equippedAvatarItemIds.has(listing.avatarItem.id);
        const state: ItemCardState = equipped
          ? 'equipped'
          : owned
            ? 'owned'
            : coinBalance >= listing.shopItem.priceCoins
              ? 'affordable'
              : 'unaffordable';
        return (
          <li key={listing.shopItem.id}>
            <ShopItemCard
              listing={listing}
              state={state}
              trying={listing.shopItem.id === tryingShopItemId}
              onClick={() => (owned ? onEquip(listing) : onPurchase(listing))}
            />
          </li>
        );
      })}
    </ul>
  );
}
