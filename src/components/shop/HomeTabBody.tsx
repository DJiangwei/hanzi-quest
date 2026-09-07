'use client';

import { useShopPurchase } from '@/lib/hooks/use-shop-purchase';
import { ShopToast } from '@/components/shop/ShopToast';
import { FurnitureCard, type CardState } from '@/components/shop/FurnitureCard';
import {
  FURNITURE_CATALOG,
  HOME_FURNITURE_COPY_CAP,
  type FurnitureCategory,
} from '@/lib/home/furniture-catalog';
import { listSurfaces, type SurfaceKind } from '@/lib/home/surfaces';
import type { ShopItemRow } from '@/lib/db/shop';

interface Props {
  childId: string;
  homeShopItems: ShopItemRow[];
  ownedShopItemIds: Set<string>;
  /** E3 multi-buy: shopItemId → owned copies (absent = 0). */
  ownedShopItemCounts?: Record<string, number>;
  coinBalance: number;
}

/** An emoji per section, because a six-year-old scans pictures before words. */
const CATEGORY_LABELS: Record<FurnitureCategory, [string, string, string]> = {
  wall_art: ['🖼️', '墙饰', 'Wall Art'],
  window_light: ['💡', '灯光', 'Lighting'],
  furniture: ['🛋️', '家具', 'Furniture'],
  rug: ['🧶', '地毯', 'Rugs'],
  plant_toy: ['🪴', '植物玩具', 'Plants & Toys'],
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
  ownedShopItemCounts = {},
  coinBalance,
}: Props) {
  const { purchase, pending, feedback, clearFeedback } = useShopPurchase(childId);

  const shopItemBySlug = new Map<string, ShopItemRow>(
    homeShopItems.map((item) => [item.slug, item]),
  );

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: FURNITURE_CATALOG.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-5 px-3 py-4">
      <ShopToast feedback={feedback} onDone={clearFeedback} />

      {grouped.map(({ cat, items }) => {
        const [emoji, zh, en] = CATEGORY_LABELS[cat];
        return (
          <section key={cat}>
            <h3 className="mb-2 flex items-baseline gap-1.5 text-sm">
              <span aria-hidden>{emoji}</span>
              <span className="font-hanzi font-extrabold text-stone-800">{zh}</span>
              <span className="text-xs italic text-stone-500">/ {en}</span>
            </h3>
            {/* A grid, not a stack. Thirty-five items one-per-row is a scroll
                with no end in sight; two columns puts a whole category on
                screen at once. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((furniture) => {
                const shopItem = shopItemBySlug.get(furniture.slug);
                const ownedCount = shopItem ? (ownedShopItemCounts[shopItem.id] ?? 0) : 0;
                const atCap = ownedCount >= HOME_FURNITURE_COPY_CAP;
                const affordable = shopItem ? coinBalance >= shopItem.priceCoins : false;

                const state: CardState = !shopItem
                  ? 'unavailable'
                  : atCap
                    ? 'maxed'
                    : !affordable
                      ? 'tooExpensive'
                      : 'buy';

                const { w, h } = furniture.footprint;
                const cell = 12.5;
                return (
                  <FurnitureCard
                    key={furniture.slug}
                    testId={furniture.slug}
                    nameZh={furniture.nameZh}
                    nameEn={furniture.nameEn}
                    priceCoins={furniture.priceCoins}
                    rarity={furniture.rarity}
                    state={state}
                    ownedCount={ownedCount}
                    pending={pending}
                    onBuy={() => shopItem && purchase(shopItem.id)}
                    preview={
                      <svg
                        viewBox={`0 0 ${w * cell} ${h * cell}`}
                        className="h-full w-full"
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden
                      >
                        <furniture.Component />
                      </svg>
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {(['wallpaper', 'floor'] as SurfaceKind[]).map((kind) => {
        const buyables = listSurfaces(kind).filter((s) => !s.isDefault);
        if (buyables.length === 0) return null;
        const vb = kind === 'wallpaper' ? '0 0 100 25' : '0 25 100 50';
        return (
          <section key={kind}>
            <h3 className="mb-2 flex items-baseline gap-1.5 text-sm">
              <span aria-hidden>{kind === 'wallpaper' ? '🎨' : '🪵'}</span>
              <span className="font-hanzi font-extrabold text-stone-800">
                {kind === 'wallpaper' ? '墙纸' : '地板'}
              </span>
              <span className="text-xs italic text-stone-500">
                / {kind === 'wallpaper' ? 'Wallpaper' : 'Floor'}
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {buyables.map((surf) => {
                const shopItem = shopItemBySlug.get(surf.slug);
                const isOwned = shopItem ? ownedShopItemIds.has(shopItem.id) : false;
                const affordable = shopItem ? coinBalance >= shopItem.priceCoins : false;
                const state: CardState = !shopItem
                  ? 'unavailable'
                  : isOwned
                    ? 'owned'
                    : !affordable
                      ? 'tooExpensive'
                      : 'buy';
                return (
                  <FurnitureCard
                    key={surf.slug}
                    testId={surf.slug}
                    nameZh={surf.nameZh}
                    nameEn={surf.nameEn}
                    priceCoins={surf.priceCoins}
                    rarity={surf.rarity}
                    state={state}
                    pending={pending}
                    onBuy={() => shopItem && purchase(shopItem.id)}
                    preview={
                      <svg viewBox={vb} className="h-full w-full rounded-lg" preserveAspectRatio="none" aria-hidden>
                        {surf.render()}
                      </svg>
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
