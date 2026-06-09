'use client';

import { AvatarRender } from '@/components/play/AvatarRender';
import type { AvatarShopListing } from '@/lib/db/shop';

export interface TryOnState {
  slot: string;
  listing: AvatarShopListing;
}

interface Props {
  equippedRefs: Partial<Record<string, string | null>>;
  tryOn: TryOnState | null;
  /** Whether the tried item is already owned (then no Buy bar). */
  owned: boolean;
  coinBalance: number;
  pending: boolean;
  onBuy: () => void;
  onClearTryOn: () => void;
}

/**
 * Big avatar preview atop the avatar shop tab. Shows the equipped look with the
 * currently-tried item overlaid on its slot, plus a contextual 购买 / Buy bar
 * when an UNOWNED item is being tried on. Try-on is ephemeral — owned items are
 * equipped directly (no Buy bar).
 */
export function AvatarTryOnPreview({
  equippedRefs,
  tryOn,
  owned,
  coinBalance,
  pending,
  onBuy,
  onClearTryOn,
}: Props) {
  const composite: Partial<Record<string, string | null>> = { ...equippedRefs };
  if (tryOn) {
    composite[tryOn.slot] = tryOn.listing.avatarItem.unlockRef;
  }

  const showBuyBar = !!tryOn && !owned;
  const price = tryOn?.listing.shopItem.priceCoins ?? 0;
  const affordable = coinBalance >= price;
  const shortfall = Math.max(price - coinBalance, 0);

  return (
    <div
      data-testid="tryon-preview"
      className="flex flex-col items-center gap-3 border-b-2 border-amber-800/20 bg-gradient-to-b from-amber-50 to-amber-100/60 px-4 py-4"
    >
      <AvatarRender
        equipped={composite}
        size={200}
        label="试穿预览 / Try-on preview"
        className="drop-shadow-md"
      />

      {showBuyBar && (
        <div className="flex w-full max-w-xs flex-col items-center gap-2">
          <div className="text-center text-sm font-bold text-amber-950">
            {tryOn!.listing.shopItem.name}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="tryon-buy"
              onClick={onBuy}
              disabled={!affordable || pending}
              className="rounded-xl border-2 border-amber-900 bg-amber-700 px-5 py-2.5 text-base font-extrabold text-amber-50 shadow-md hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              购买 / Buy · 🪙 {price}
            </button>
            <button
              type="button"
              onClick={onClearTryOn}
              disabled={pending}
              className="rounded-xl border-2 border-amber-800/40 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              卸下 / Take off
            </button>
          </div>
          {!affordable && (
            <div className="text-center text-xs font-semibold text-red-700">
              再赚 {shortfall} 个金币 / Earn {shortfall} more coins
            </div>
          )}
        </div>
      )}
    </div>
  );
}
