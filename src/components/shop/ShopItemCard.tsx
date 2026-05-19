'use client';

import { AvatarRender } from '@/components/play/AvatarRender';
import type { AvatarShopListing } from '@/lib/db/shop';
import { lookupItem } from '@/lib/avatar/itemCatalog';

export type ItemCardState =
  | 'equipped'
  | 'owned'
  | 'affordable'
  | 'unaffordable';

const RARITY_LABEL: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
};

const RARITY_RING: Record<string, string> = {
  common: 'ring-stone-300',
  rare: 'ring-sky-400',
  epic: 'ring-amber-400',
};

interface Props {
  listing: AvatarShopListing;
  state: ItemCardState;
  onClick: () => void;
}

export function ShopItemCard({ listing, state, onClick }: Props) {
  const { shopItem, avatarItem } = listing;
  const catalogItem = lookupItem(avatarItem.unlockRef);
  const rarity =
    (shopItem.metadata as { rarity?: string } | null)?.rarity ??
    catalogItem?.rarity ??
    'common';

  const previewEquipped = catalogItem
    ? { [catalogItem.slot]: catalogItem.unlockRef }
    : undefined;

  const stateBadge = (() => {
    switch (state) {
      case 'equipped':
        return (
          <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
            ✓ 已装备
          </span>
        );
      case 'owned':
        return (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
            点击装备
          </span>
        );
      case 'affordable':
        return (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
            🪙 {shopItem.priceCoins}
          </span>
        );
      case 'unaffordable':
        return (
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-600">
            🪙 {shopItem.priceCoins}
          </span>
        );
    }
  })();

  const isInactive = state === 'unaffordable' || state === 'equipped';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'equipped'}
      aria-label={`${shopItem.name}${state === 'affordable' ? `，价格 ${shopItem.priceCoins} 金币` : ''}`}
      className={[
        'group relative flex flex-col items-center gap-1 rounded-2xl bg-amber-50 p-3 ring-2 transition',
        RARITY_RING[rarity] ?? RARITY_RING.common,
        isInactive ? 'opacity-90' : 'hover:-translate-y-0.5 hover:shadow-md',
        state === 'equipped' ? 'cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      <AvatarRender
        equipped={previewEquipped}
        size={88}
        label={shopItem.name}
        className="drop-shadow-sm"
      />
      <div className="mt-0.5 line-clamp-1 text-sm font-bold text-amber-950">
        {shopItem.name}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-amber-900/60">
        <span>{RARITY_LABEL[rarity] ?? '普通'}</span>
      </div>
      <div className="mt-0.5">{stateBadge}</div>
    </button>
  );
}
