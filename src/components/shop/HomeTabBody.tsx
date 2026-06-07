'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import { FURNITURE_CATALOG, type FurnitureCategory } from '@/lib/home/furniture-catalog';
import type { ShopItemRow } from '@/lib/db/shop';

interface Props {
  childId: string;
  homeShopItems: ShopItemRow[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
}

const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  wall_art: '墙饰 / Wall Art',
  window_light: '灯光 / Lighting',
  furniture: '家具 / Furniture',
  rug: '地毯 / Rugs',
  plant_toy: '植物玩具 / Plants & Toys',
};

const CATEGORY_ORDER: FurnitureCategory[] = [
  'furniture',
  'rug',
  'wall_art',
  'window_light',
  'plant_toy',
];

export function HomeTabBody({
  childId,
  homeShopItems,
  ownedShopItemIds,
  coinBalance,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Map slug → shop_items row so we can resolve shopItemId for each catalog entry
  const shopItemBySlug = new Map<string, ShopItemRow>(
    homeShopItems.map((item) => [item.slug, item]),
  );

  const purchase = (shopItemId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await purchaseShopItemAction(shopItemId, { childId });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : '购买失败');
      }
    });
  };

  // Group catalog items by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: FURNITURE_CATALOG.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-4 px-3 py-4">
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {grouped.map(({ cat, items }) => (
        <section key={cat}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-900/70">
            {CATEGORY_LABELS[cat]}
          </h3>
          <div className="flex flex-col gap-3">
            {items.map((furniture) => {
              const shopItem = shopItemBySlug.get(furniture.slug);
              const isOwned = shopItem ? ownedShopItemIds.has(shopItem.id) : false;
              const affordable = shopItem ? coinBalance >= shopItem.priceCoins : false;

              let actionLabel: string;
              let actionDisabled = false;
              let onAction: () => void = () => {};

              if (!shopItem) {
                // seed not yet run — show placeholder
                actionLabel = '即将上线';
                actionDisabled = true;
              } else if (isOwned) {
                actionLabel = '已购买 / Owned';
                actionDisabled = true;
              } else if (!affordable) {
                actionLabel = `🪙 ${shopItem.priceCoins}`;
                actionDisabled = true;
              } else {
                actionLabel = `购买 / Buy 🪙 ${shopItem.priceCoins}`;
                onAction = () => purchase(shopItem.id);
              }

              // SVG preview: each Component renders inside a viewBox sized to the footprint
              const { w, h } = furniture.footprint;
              const cellSize = 12.5;
              const vbW = w * cellSize;
              const vbH = h * cellSize;

              return (
                <article
                  key={furniture.slug}
                  className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {/* SVG preview */}
                    <svg
                      viewBox={`0 0 ${vbW} ${vbH}`}
                      width={Math.min(60, vbW * 3)}
                      height={Math.min(60, vbH * 3)}
                      aria-hidden
                      className="shrink-0 rounded-lg border border-amber-200 bg-amber-100"
                    >
                      <furniture.Component />
                    </svg>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-extrabold text-amber-950">
                          {furniture.nameZh}
                        </span>
                        {furniture.rarity !== 'common' && (
                          <span
                            className={[
                              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                              furniture.rarity === 'epic'
                                ? 'bg-purple-200 text-purple-900'
                                : 'bg-amber-300 text-amber-900',
                            ].join(' ')}
                          >
                            {furniture.rarity === 'epic' ? '★★★' : '★★'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-amber-900">
                        {furniture.nameEn}
                      </div>
                      <div className="text-xs text-amber-700">
                        {w > 1 || h > 1 ? `${w}×${h} 格` : '1×1 格'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-900">
                      🪙 {furniture.priceCoins}
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
                      已添加到你的房间 / Added to your home
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
