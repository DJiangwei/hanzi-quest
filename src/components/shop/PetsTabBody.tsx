'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { equipPetAction } from '@/lib/actions/pet';
import { useShopPurchase } from '@/lib/hooks/use-shop-purchase';
import { ShopToast } from '@/components/shop/ShopToast';
import type { PetShopListing } from '@/lib/db/pets';

interface Props {
  childId: string;
  listings: PetShopListing[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
  equippedPetSlug: string | null;
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function PetsTabBody({
  childId,
  listings,
  ownedShopItemIds,
  coinBalance,
  equippedPetSlug,
}: Props) {
  const router = useRouter();
  const [equipPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { purchase: purchaseItem, pending: purchasePending, feedback, clearFeedback } =
    useShopPurchase(childId);
  const pending = equipPending || purchasePending;

  const equip = (slug: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        await equipPetAction(childId, slug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Equip failed');
      }
    });
  };

  // Purchase feedback flows through the toast; on a real purchase, equip the pet.
  const purchase = (shopItemId: string, slug: string) => {
    setError(null);
    purchaseItem(shopItemId, () => {
      void equipPetAction(childId, slug).then(() => router.refresh());
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      <ShopToast feedback={feedback} onDone={clearFeedback} />
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const isOwned = ownedShopItemIds.has(l.shopItem.id);
        const isEquipped = equippedPetSlug === l.shopItem.slug;
        const affordable = coinBalance >= l.shopItem.priceCoins;

        let actionLabel: string;
        let actionDisabled = false;
        let onAction: () => void;
        if (isEquipped) {
          actionLabel = '已装备 / Equipped';
          actionDisabled = true;
          onAction = () => {};
        } else if (isOwned) {
          actionLabel = '装备 / Equip';
          onAction = () => equip(l.shopItem.slug);
        } else if (!affordable) {
          actionLabel = `🪙 ${l.shopItem.priceCoins}`;
          actionDisabled = true;
          onAction = () => {};
        } else {
          actionLabel = `购买 / Buy 🪙 ${l.shopItem.priceCoins}`;
          onAction = () => purchase(l.shopItem.id, l.shopItem.slug);
        }

        return (
          <article
            key={l.shopItem.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="text-5xl" aria-hidden>
                {l.pet.emoji}
              </div>
              <div className="flex-1">
                <div className="text-base font-extrabold text-amber-950">{zh}</div>
                <div className="text-sm font-semibold text-amber-900">{en}</div>
              </div>
            </div>
            {l.shopItem.description && (
              <p className="text-xs whitespace-pre-line text-amber-900/80">{l.shopItem.description}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-900">🪙 {l.shopItem.priceCoins}</span>
              <button
                type="button"
                disabled={actionDisabled || pending}
                onClick={onAction}
                className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
              >
                {actionLabel}
              </button>
            </div>
            {isEquipped && (
              <span className="self-start rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">
                已装备 / Equipped
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
