'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShardPill } from './ShardPill';
import { SwapDialog } from './SwapDialog';
import { CardDetailDialog } from './CardDetailDialog';
import { TrophyToast } from './TrophyToast';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { CollectibleItem, OwnedCollectibleItem } from '@/lib/db/collections';
import type { GrantedTrophy } from '@/lib/actions/play';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { swapShardsForItem, convertDuplicateToShard } from '@/lib/actions/gacha';
import { shardSwapCostForPack } from '@/lib/economy/shards';

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
  /** Universal (global) shard wallet for this child — spendable on any pack. */
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
  // Per-pack swap cost (3 regular; 12 for the festival/season limited packs).
  const SWAP_COST = shardSwapCostForPack(packSlug);
  const router = useRouter();
  const ownedSet = new Set(ownedItemIds);

  // Build a map from item id → count for dupe badge rendering
  const countById = new Map<string, number>(
    ownedItems.map((o) => [o.id, o.count]),
  );

  const [swapItem, setSwapItem] = useState<CollectibleItem | null>(null);
  const [detailItem, setDetailItem] = useState<CollectibleItem | null>(null);
  const [continentTrophies, setContinentTrophies] = useState<GrantedTrophy[]>([]);
  const [, startConvert] = useTransition();

  // Scroll-jump nav: tap a group chip → scroll its section into view.
  const scrollToGroup = (key: string) => {
    document
      .getElementById(`pack-section-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const convert = (itemId: string) => {
    startConvert(async () => {
      await convertDuplicateToShard(childId, itemId);
      // revalidatePath in the action refreshes the server data; re-render to
      // reflect the new ×N count + shard pill.
      router.refresh();
    });
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${meta.gridColumns ?? 3}, minmax(0, 1fr))`,
  };

  // One tile = card + ×N dupe badge + (owned dupe → convert chip | unowned →
  // swap chip). Identical in the flat and grouped layouts.
  function PackTile({ item }: { item: CollectibleItem }) {
    const Card = meta!.ItemCard;
    const count = countById.get(item.id) ?? 0;
    const isOwned = ownedSet.has(item.id);
    return (
      <div
        className="relative cursor-pointer rounded-xl focus-within:outline focus-within:outline-2 focus-within:outline-amber-400"
        role="button"
        tabIndex={0}
        data-testid="card-tap"
        aria-label={`${item.nameZh} / ${item.nameEn}`}
        onClick={() => setDetailItem(item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailItem(item);
          }
        }}
      >
        <Card item={item} owned={isOwned} size="md" compact={false} />
        {count > 1 && (
          <span className="absolute right-0.5 top-0.5 z-10 rounded-full bg-sky-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
            ×{count}
          </span>
        )}
        {isOwned && count > 1 && (
          <button
            type="button"
            data-testid="convert-chip"
            onClick={(e) => {
              e.stopPropagation();
              convert(item.id);
            }}
            className="absolute inset-x-1 bottom-1 z-10 min-h-6 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white"
          >
            ♻️ 换碎片 / To shard
          </button>
        )}
        {!isOwned && (
          <button
            type="button"
            data-testid="swap-chip"
            disabled={shardCount < SWAP_COST}
            onClick={(e) => {
              e.stopPropagation();
              setSwapItem(item);
            }}
            className={`absolute inset-x-1 bottom-1 z-10 min-h-6 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              shardCount >= SWAP_COST
                ? 'bg-sky-500 text-white'
                : 'bg-stone-300 text-stone-600'
            }`}
          >
            {shardCount >= SWAP_COST ? '🔹换卡 / Trade' : `需 ${SWAP_COST}🔹`}
          </button>
        )}
      </div>
    );
  }

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

      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-900">
        <p>重复的卡可以换成 🔹 碎片，{SWAP_COST} 个碎片换一张你想要的新卡。</p>
        <p className="italic opacity-80">
          Turn duplicate cards into 🔹 shards — {SWAP_COST} shards trade for any new card you want.
        </p>
      </div>

      <div className="rounded-2xl border border-[#c89f5e] bg-[linear-gradient(180deg,#f5ead0_0%,#ead7a8_100%)] p-4">
        {meta.grouping ? (
          <div className="flex flex-col gap-4">
            {/* Scroll-jump nav — one chip per group, sticky at the top. */}
            <div
              data-testid="continent-nav"
              className="sticky top-0 z-20 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl bg-[#f1e3c2]/95 px-1 py-1.5 backdrop-blur"
            >
              {meta.grouping.order.map((key) => {
                if (!items.some((i) => meta.grouping!.resolveGroup(i.slug) === key)) {
                  return null;
                }
                const label = meta.grouping!.labels[key];
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid={`continent-nav-${key}`}
                    onClick={() => scrollToGroup(key)}
                    className="flex shrink-0 items-center gap-1 rounded-full border-2 border-[#c89f5e] bg-white/80 px-2.5 py-1 text-xs font-bold text-[var(--color-treasure-800)] hover:bg-white"
                  >
                    <span aria-hidden>{label.emoji}</span>
                    {label.zh}
                  </button>
                );
              })}
            </div>
            {meta.grouping.order.map((key) => {
              const groupItems = items.filter(
                (i) => meta.grouping!.resolveGroup(i.slug) === key,
              );
              if (groupItems.length === 0) return null;
              const label = meta.grouping!.labels[key];
              const ownedInGroup = groupItems.filter((i) =>
                ownedSet.has(i.id),
              ).length;
              return (
                <section
                  key={key}
                  id={`pack-section-${key}`}
                  data-testid={`pack-section-${key}`}
                  className="scroll-mt-14"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">
                      {label.emoji}
                    </span>
                    <h2 className="font-hanzi text-lg font-bold text-[var(--color-treasure-800)]">
                      {label.zh}
                    </h2>
                    <span className="text-sm text-[var(--color-treasure-700)]">
                      {label.en}
                    </span>
                    <span className="ml-auto text-xs font-semibold text-[var(--color-treasure-600)]">
                      {ownedInGroup}/{groupItems.length}
                    </span>
                  </div>
                  <div className="grid gap-2.5" style={gridStyle}>
                    {groupItems.map((item) => (
                      <PackTile key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="pack-grid-with-badges"
            className="grid gap-2.5"
            style={gridStyle}
          >
            {items.map((item) => (
              <PackTile key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {swapItem ? (
        <SwapDialog
          open
          onClose={() => setSwapItem(null)}
          itemNameZh={swapItem.nameZh}
          itemNameEn={swapItem.nameEn}
          shardCost={SWAP_COST}
          shardBalance={shardCount}
          onConfirm={async () => {
            const result = await swapShardsForItem(childId, swapItem.id);
            setSwapItem(null);
            if (result.ok && result.continentTrophies.length > 0) {
              // Swapping for the last flag of a continent earns its trophy.
              setContinentTrophies(result.continentTrophies);
            }
            // revalidatePath in the action handles the data refresh.
          }}
        />
      ) : null}

      <TrophyToast
        trophies={continentTrophies}
        onDone={() => setContinentTrophies([])}
      />

      {detailItem ? (
        <CardDetailDialog
          packSlug={packSlug}
          item={detailItem}
          owned={ownedSet.has(detailItem.id)}
          onClose={() => setDetailItem(null)}
        />
      ) : null}
    </div>
  );
}
