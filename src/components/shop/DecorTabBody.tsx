'use client';

import { useState } from 'react';
import { useShopPurchase } from '@/lib/hooks/use-shop-purchase';
import { ShopToast } from '@/components/shop/ShopToast';
import { TrophyToast } from '@/components/play/TrophyToast';
import type { DecorShopListing } from '@/lib/db/decor';
import type { GrantedTrophy } from '@/lib/db/trophies';

interface Props {
  childId: string;
  listings: DecorShopListing[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function DecorTabBody({
  childId,
  listings,
  ownedShopItemIds,
  coinBalance,
}: Props) {
  const { purchase: purchaseItem, pending, feedback, clearFeedback } =
    useShopPurchase(childId);
  const [toastTrophies, setToastTrophies] = useState<GrantedTrophy[]>([]);

  const purchase = (shopItemId: string) => {
    purchaseItem(shopItemId, (trophies) => {
      if (trophies.length > 0) setToastTrophies(trophies);
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      <ShopToast feedback={feedback} onDone={clearFeedback} />

      <TrophyToast
        trophies={toastTrophies}
        onDone={() => setToastTrophies([])}
      />

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const isOwned = ownedShopItemIds.has(l.shopItem.id);
        const affordable = coinBalance >= l.shopItem.priceCoins;

        let actionLabel: string;
        let actionDisabled = false;
        let onAction: () => void = () => {};
        if (isOwned) {
          actionLabel = '已拥有 / Owned';
          actionDisabled = true;
        } else if (!affordable) {
          actionLabel = `🪙 ${l.shopItem.priceCoins}`;
          actionDisabled = true;
        } else {
          actionLabel = `购买 / Buy 🪙 ${l.shopItem.priceCoins}`;
          onAction = () => purchase(l.shopItem.id);
        }

        return (
          <article
            key={l.shopItem.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="text-5xl" aria-hidden>
                {l.decoration.emoji}
              </div>
              <div className="flex-1">
                <div className="text-base font-extrabold text-amber-950">{zh}</div>
                <div className="text-sm font-semibold text-amber-900">{en}</div>
              </div>
            </div>
            {l.shopItem.description && (
              <p className="text-xs whitespace-pre-line text-amber-900/80">
                {l.shopItem.description}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-900">
                🪙 {l.shopItem.priceCoins}
              </span>
              <button
                type="button"
                disabled={actionDisabled || pending}
                onClick={onAction}
                className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
              >
                {actionLabel}
              </button>
            </div>
            {isOwned && (
              <p className="text-xs text-emerald-800">
                装饰已添加到航海图 / Decoration added to your map
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
