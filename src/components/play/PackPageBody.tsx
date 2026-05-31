'use client';

import { useRouter } from 'next/navigation';
import { PackGrid } from './PackGrid';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { CollectibleItem } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';

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
  packSlug,
  items,
  ownedItemIds,
  balance,
}: Props) {
  const meta = getPackMeta(packSlug);
  if (!meta) {
    throw new Error(`PackPageBody: no UI meta registered for ${packSlug}`);
  }
  const router = useRouter();
  const ownedSet = new Set(ownedItemIds);

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
          🪙 {balance}
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

      <div className="rounded-2xl border border-[#c89f5e] bg-[linear-gradient(180deg,#f5ead0_0%,#ead7a8_100%)] p-4">
        <PackGrid items={items} ownedItemIds={ownedSet} meta={meta} />
      </div>
    </div>
  );
}
