'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CollectibleItem } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { SpeakButton } from '@/components/play/SpeakButton';
import { HoloShimmer, isLimitedPack } from '@/components/play/items/HoloShimmer';
import { GiftDialog } from '@/components/play/GiftDialog';
import type { CrewMate } from '@/lib/db/crew';

interface Props {
  /**
   * Resolved to `getPackMeta(packSlug)` CLIENT-side. We deliberately do NOT take
   * `meta` as a prop — `PackUiMeta` carries a React component (`ItemCard`) +
   * callbacks that don't survive RSC serialisation. Same hazard as PackPageBody.
   */
  packSlug: string;
  item: CollectibleItem;
  owned: boolean;
  onClose: () => void;
  /** How many of this card the child holds. Gift needs a SPARE — the button
   * only appears at 2+, since gifting a lone copy would cost the giver their
   * own card. */
  ownedCount: number;
  childId: string;
  /** Everyone else in the deployment — plain data, never a real name. */
  crew: CrewMate[];
  /** itemId → childIds of crewmates who already own it, scoped to this pack. */
  ownersByItem: Record<string, string[]>;
  giftsSentToday: number;
}

/**
 * Tap-to-open big card detail, reused across ALL packs. Renders the pack's own
 * `ItemCard` at `size="lg"` (which already shows the rich detail + lore when
 * owned) plus a 🔊 read-aloud of the Chinese name. Unowned items show a friendly
 * locked teaser instead of the lore.
 */
export function CardDetailDialog({
  packSlug,
  item,
  owned,
  onClose,
  ownedCount,
  childId,
  crew,
  ownersByItem,
  giftsSentToday,
}: Props) {
  const meta = getPackMeta(packSlug);
  const router = useRouter();
  const [giftOpen, setGiftOpen] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The "已送出 / Sent" toast is self-clearing — no dismiss button needed for
  // a message this small.
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 2500);
    return () => clearTimeout(t);
  }, [sent]);

  if (!meta) return null;
  const Card = meta.ItemCard;

  return (
    <>
      <div
        data-testid="card-detail-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.nameZh} / ${item.nameEn}`}
      >
        <div
          className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border-4 border-amber-300 bg-amber-50 p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <HoloShimmer active={owned && isLimitedPack(packSlug)}>
            <Card item={item} owned={owned} size="lg" />
          </HoloShimmer>

          <SpeakButton text={item.nameZh} size="md" label="读一读 / Read aloud" />

          {!owned && (
            <div className="rounded-xl bg-stone-100 px-3 py-2 text-center text-xs font-medium leading-snug text-stone-600">
              <p>❓ 还没收集 / Not collected yet</p>
              <p className="mt-0.5 opacity-80">
                通关 Boss 或用 🔹 碎片兑换 / Clear a boss or trade 🔹 shards
              </p>
            </div>
          )}

          {ownedCount >= 2 && (
            <button
              type="button"
              data-testid="gift-button"
              onClick={() => setGiftOpen(true)}
              className="w-full rounded-full border-2 border-sky-400 bg-sky-100 px-5 py-2 text-sm font-bold text-sky-900 hover:bg-sky-200"
            >
              🎁 送给船员 / Gift to a crewmate
            </button>
          )}

          {sent && (
            <p
              data-testid="gift-sent-toast"
              className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-bold text-emerald-800"
            >
              🎁 已送出 / Sent
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-full border-2 border-amber-800/40 bg-white px-5 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
          >
            ✕ 关闭 / Close
          </button>
        </div>
      </div>

      {giftOpen && (
        <GiftDialog
          open={giftOpen}
          onClose={() => setGiftOpen(false)}
          fromChildId={childId}
          itemId={item.id}
          itemNameZh={item.nameZh}
          itemNameEn={item.nameEn}
          crew={crew}
          ownerIds={ownersByItem[item.id] ?? []}
          giftsSentToday={giftsSentToday}
          onSent={() => {
            setGiftOpen(false);
            setSent(true);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
