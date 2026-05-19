'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackGrid } from './PackGrid';
import { GachaPullButton } from './GachaPullButton';
import { TreasureChestReveal } from '@/components/scenes/fx/TreasureChestReveal';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { CollectibleItem, CollectionPack } from '@/lib/db/collections';
import type { PackUiMeta } from '@/lib/collections/packRegistry';
import type { PullResult } from '@/lib/db/gacha';

interface Props {
  childId: string;
  pack: CollectionPack;
  meta: PackUiMeta;
  items: CollectibleItem[];
  ownedItemIds: string[];
  balance: number;
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
  pack,
  meta,
  items,
  ownedItemIds,
  balance,
}: Props) {
  const router = useRouter();
  const [reveal, setReveal] = useState<PullResult | null>(null);
  const [optimisticBalance, setOptimisticBalance] = useState(balance);
  const ownedSet = new Set(ownedItemIds);

  if (reveal) {
    const revealEmoji = meta.resolveRevealEmoji?.(reveal.item.slug) ?? null;
    return (
      <div className="flex flex-col items-center gap-4">
        <TreasureChestReveal
          item={{
            id: reveal.item.id,
            slug: reveal.item.slug,
            nameZh: reveal.item.nameZh,
            nameEn: reveal.item.nameEn,
            loreZh: reveal.item.loreZh,
            loreEn: reveal.item.loreEn,
            emoji: revealEmoji,
          }}
          wasDuplicate={reveal.wasDuplicate}
          shardsAfter={reveal.shardsAfter}
        />
        <WoodSignButton
          size="lg"
          onClick={() => {
            setReveal(null);
            router.refresh();
          }}
        >
          再看一眼 / Look again
        </WoodSignButton>
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
        <span className="text-sm font-semibold text-[var(--color-treasure-700)]">
          🪙 {optimisticBalance}
        </span>
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

      <GachaPullButton
        balance={optimisticBalance}
        cost={meta.paidPullCost}
        packSlug={pack.slug}
        childId={childId}
        onResult={(r) => {
          setOptimisticBalance(r.coinsAfter);
          setReveal(r);
        }}
      />

      <div className="rounded-2xl border border-[#c89f5e] bg-[linear-gradient(180deg,#f5ead0_0%,#ead7a8_100%)] p-4">
        <PackGrid items={items} ownedItemIds={ownedSet} meta={meta} />
      </div>
    </div>
  );
}
