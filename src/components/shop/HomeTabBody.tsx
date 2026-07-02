'use client';

import { useShopPurchase } from '@/lib/hooks/use-shop-purchase';
import { ShopToast } from '@/components/shop/ShopToast';
import { FURNITURE_CATALOG, type FurnitureCategory } from '@/lib/home/furniture-catalog';
import { listSurfaces, type SurfaceKind } from '@/lib/home/surfaces';
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
  const { purchase, pending, feedback, clearFeedback } = useShopPurchase(childId);

  // Map slug → shop_items row so we can resolve shopItemId for each catalog entry
  const shopItemBySlug = new Map<string, ShopItemRow>(
    homeShopItems.map((item) => [item.slug, item]),
  );

  // Group catalog items by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: FURNITURE_CATALOG.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-4 px-3 py-4">
      <ShopToast feedback={feedback} onDone={clearFeedback} />

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
                actionLabel = '即将上线 / Coming soon';
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
                        {w > 1 || h > 1 ? `${w}×${h} 格 / cells` : '1×1 格 / cell'}
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

      {(['wallpaper', 'floor'] as SurfaceKind[]).map((kind) => {
        const buyables = listSurfaces(kind).filter((s) => !s.isDefault);
        if (buyables.length === 0) return null;
        const vb = kind === 'wallpaper' ? '0 0 100 25' : '0 25 100 50';
        return (
          <section key={kind}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-900/70">
              {kind === 'wallpaper' ? '🖼️ 墙纸 / Wallpaper' : '🪵 地板 / Floor'}
            </h3>
            <div className="flex flex-col gap-3">
              {buyables.map((s) => {
                const shopItem = shopItemBySlug.get(s.slug);
                const isOwned = shopItem ? ownedShopItemIds.has(shopItem.id) : false;
                const affordable = shopItem ? coinBalance >= shopItem.priceCoins : false;
                let actionLabel: string;
                let actionDisabled = false;
                let onAction: () => void = () => {};
                if (!shopItem) {
                  actionLabel = '即将上线 / Coming soon';
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
                return (
                  <article
                    key={s.slug}
                    className="flex items-center gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-3 shadow-sm"
                  >
                    <svg
                      viewBox={vb}
                      width={64}
                      height={40}
                      preserveAspectRatio="none"
                      aria-hidden
                      className="shrink-0 rounded-lg border border-amber-200"
                    >
                      {s.render()}
                    </svg>
                    <div className="flex-1">
                      <div className="text-base font-extrabold text-amber-950">{s.nameZh}</div>
                      <div className="text-sm font-semibold text-amber-900">{s.nameEn}</div>
                    </div>
                    <button
                      type="button"
                      disabled={actionDisabled || pending}
                      onClick={onAction}
                      className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
                    >
                      {actionLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
