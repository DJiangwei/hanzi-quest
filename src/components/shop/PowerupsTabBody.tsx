'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import type {
  PowerupShopListing,
  PowerupCounts,
  PowerupKind,
} from '@/lib/db/powerups';

interface Props {
  childId: string;
  listings: PowerupShopListing[];
  powerupCounts: PowerupCounts;
  coinBalance: number;
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function PowerupsTabBody({
  childId,
  listings,
  powerupCounts,
  coinBalance,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const purchase = (shopItemId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await purchaseShopItemAction(shopItemId, { childId });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const meta = (l.shopItem.metadata ?? {}) as { powerupKind?: PowerupKind };
        const kind = meta.powerupKind;
        const owned = kind ? powerupCounts[kind] : 0;
        const affordable = coinBalance >= l.shopItem.priceCoins;

        return (
          <article
            key={l.shopItem.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="text-5xl" aria-hidden>
                {l.shopItem.imageUrl}
              </div>
              <div className="flex-1">
                <div className="text-base font-extrabold text-amber-950">{zh}</div>
                <div className="text-sm font-semibold text-amber-900">{en}</div>
              </div>
              <div className="rounded-full border-2 border-amber-800/40 bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-900">
                拥有: {owned} / Own: {owned}
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
                disabled={!affordable || pending}
                onClick={() => purchase(l.shopItem.id)}
                className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
              >
                {affordable
                  ? `购买 / Buy 🪙 ${l.shopItem.priceCoins}`
                  : `🪙 ${l.shopItem.priceCoins}`}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
