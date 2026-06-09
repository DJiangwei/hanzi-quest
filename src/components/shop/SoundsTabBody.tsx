'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { equipSoundThemeAction } from '@/lib/actions/settings';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import { setAudioTheme } from '@/lib/audio/play';
import { getTheme } from '@/lib/audio/themes';
import type { SoundThemeListing } from '@/lib/db/shop';

interface Props {
  childId: string;
  listings: SoundThemeListing[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
  equippedThemeSlug: string | null;
}

interface CardProps {
  emoji: string;
  nameZh: string;
  nameEn: string;
  description: string | null;
  priceCoins: number | null;
  isEquipped: boolean;
  pending: boolean;
  onPreview: () => void;
  onAction: () => void;
  actionLabel: string;
  actionDisabled: boolean;
}

function SoundThemeCard(p: CardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-5xl" aria-hidden>
          {p.emoji}
        </div>
        <div className="flex-1">
          <div className="text-base font-extrabold text-amber-950">
            {p.nameEn ? `${p.nameZh} / ${p.nameEn}` : p.nameZh}
          </div>
        </div>
        <button
          type="button"
          onClick={p.onPreview}
          aria-label="Preview / 试听"
          className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-900 hover:bg-amber-300"
        >
          🔊
        </button>
      </div>
      {p.description && (
        <p className="text-xs whitespace-pre-line text-amber-900/80">{p.description}</p>
      )}
      <div className="flex items-center justify-between">
        {p.priceCoins !== null ? (
          <span className="text-sm font-bold text-amber-900">🪙 {p.priceCoins}</span>
        ) : (
          <span className="text-sm font-semibold text-amber-900/70">免费 / Free</span>
        )}
        <button
          type="button"
          disabled={p.actionDisabled || p.pending}
          onClick={p.onAction}
          className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
        >
          {p.actionLabel}
        </button>
      </div>
      {p.isEquipped && (
        <span className="self-start rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">
          已装备 / Equipped
        </span>
      )}
    </article>
  );
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function SoundsTabBody({
  childId,
  listings,
  ownedShopItemIds,
  coinBalance,
  equippedThemeSlug,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preview = async (slug: string) => {
    const theme = getTheme(slug);
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    theme.ding(ctx);
  };

  const equip = (slug: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await equipSoundThemeAction(childId, slug);
        setAudioTheme(result.themeSlug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Equip failed');
      }
    });
  };

  const purchase = (shopItemId: string, slug: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await purchaseShopItemAction(shopItemId, { childId });
        const result = await equipSoundThemeAction(childId, slug);
        setAudioTheme(result.themeSlug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
      }
    });
  };

  const defaultEquipped = equippedThemeSlug === null;

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      <SoundThemeCard
        emoji="🎵"
        nameZh="默认"
        nameEn="Default"
        description="经典的探险音效。/ Classic adventure sound effects."
        priceCoins={null}
        isEquipped={defaultEquipped}
        pending={pending}
        onPreview={() => { void preview('default'); }}
        onAction={() => equip(null)}
        actionLabel={defaultEquipped ? '已装备 / Equipped' : '装备 / Equip'}
        actionDisabled={defaultEquipped}
      />

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const isOwned = ownedShopItemIds.has(l.shopItem.id);
        const isEquipped = equippedThemeSlug === l.shopItem.slug;
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
          <SoundThemeCard
            key={l.shopItem.id}
            emoji={l.shopItem.imageUrl ?? '🎵'}
            nameZh={zh}
            nameEn={en}
            description={l.shopItem.description}
            priceCoins={l.shopItem.priceCoins}
            isEquipped={isEquipped}
            pending={pending}
            onPreview={() => { void preview(l.shopItem.slug); }}
            onAction={onAction}
            actionLabel={actionLabel}
            actionDisabled={actionDisabled}
          />
        );
      })}
    </div>
  );
}
