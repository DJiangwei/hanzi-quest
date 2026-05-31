'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackGrid } from './PackGrid';
import { ShardPill } from './ShardPill';
import { SwapDialog } from './SwapDialog';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { CollectibleItem, OwnedCollectibleItem } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { swapShardsForItem } from '@/lib/actions/gacha';

interface Props {
  childId: string;
  /**
   * Looked up via `getPackMeta(packSlug)` on the client. We deliberately do
   * NOT take `meta` as a prop — `PackUiMeta` carries a React component
   * (`ItemCard`) and a callback (`resolveRevealEmoji`), neither of which
   * survives RSC serialisation across the server→client boundary.
   */
  packSlug: string;
  items: CollectibleItem[];
  ownedItemIds: string[];
  /** Full owned records with count — used for ×N dupe badges. */
  ownedItems: OwnedCollectibleItem[];
  balance: number;
  /** Shard balance for this child × pack pair. */
  shardCount: number;
}

/**
 * Generic per-pack page body. Replaces the zodiac-locked CollectionPageBody.
 *
 * The reveal animation still uses TreasureChestReveal — that component is
 * zodiac-aware via the `slug` prop, but degrades gracefully for non-zodiac
 * packs (renders the slug as a generic card). When non-zodiac packs need a
 * pack-themed reveal, swap in a per-pack reveal component via the registry.
 */
export function PackPageBody({
  childId,
  packSlug,
  items,
  ownedItemIds,
  ownedItems,
  balance,
  shardCount,
}: Props) {
  const meta = getPackMeta(packSlug);
  if (!meta) {
    throw new Error(`PackPageBody: no UI meta registered for ${packSlug}`);
  }
  const router = useRouter();
  const ownedSet = new Set(ownedItemIds);

  // Build a map from item id → count for dupe badge rendering
  const countById = new Map<string, number>(
    ownedItems.map((o) => [o.id, o.count]),
  );

  const [swapItem, setSwapItem] = useState<CollectibleItem | null>(null);

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <WoodSignButton
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/play/${childId}/collection`)}
        >
          ← 收藏馆 / Atlas
        </WoodSignButton>
        <div className="flex items-center gap-2">
          <ShardPill count={shardCount} />
          <span className="text-sm font-semibold text-[var(--color-treasure-700)]">
            🪙 {balance}
          </span>
        </div>
      </div>

      <header
        className={`rounded-2xl border-2 border-stone-300 p-4 text-center ${meta.themeBannerClass}`}
      >
        <div className={`text-3xl ${meta.themeAccentClass}`}>{meta.themeEmoji}</div>
        <h1
          className={`mt-1 font-hanzi text-2xl font-extrabold ${meta.themeAccentClass}`}
        >
          {meta.displayNameZh}
        </h1>
        <p className={`text-base font-semibold ${meta.themeAccentClass}`}>
          {meta.displayNameEn}
        </p>
        <p className={`mt-1 text-sm font-medium ${meta.themeAccentClass}`}>
          {ownedSet.size} / {items.length} · {meta.sloganZh}
        </p>
        <p className={`text-xs italic ${meta.themeAccentClass} opacity-80`}>
          {meta.sloganEn}
        </p>
      </header>

      <div className="rounded-2xl border border-[#c89f5e] bg-[linear-gradient(180deg,#f5ead0_0%,#ead7a8_100%)] p-4">
        <div
          data-testid="pack-grid-with-badges"
          className={`grid grid-cols-${meta.gridColumns ?? 3} gap-2.5`}
          style={{ gridTemplateColumns: `repeat(${meta.gridColumns ?? 3}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const Card = meta.ItemCard;
            const count = countById.get(item.id) ?? 0;
            const showDupe = count > 1;
            const isOwned = ownedSet.has(item.id);
            return (
              <div
                key={item.id}
                className="relative"
                onClick={isOwned ? undefined : () => setSwapItem(item)}
                role={isOwned ? undefined : 'button'}
                tabIndex={isOwned ? undefined : 0}
                onKeyDown={
                  isOwned
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSwapItem(item);
                      }
                }
              >
                <Card
                  item={item}
                  owned={isOwned}
                  size="md"
                  compact={false}
                />
                {showDupe && (
                  <span className="absolute right-0.5 top-0.5 z-10 rounded-full bg-sky-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                    ×{count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {swapItem ? (
        <SwapDialog
          open
          onClose={() => setSwapItem(null)}
          itemNameZh={swapItem.nameZh}
          itemNameEn={swapItem.nameEn}
          shardCost={3}
          shardBalance={shardCount}
          onConfirm={async () => {
            const result = await swapShardsForItem(childId, swapItem.id);
            if (result.ok) {
              setSwapItem(null);
              // revalidatePath in the action handles refresh
            } else {
              // No toast UX in this PR; just close. v2 candidate.
              setSwapItem(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
