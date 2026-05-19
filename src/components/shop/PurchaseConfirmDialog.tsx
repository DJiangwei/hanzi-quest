'use client';

import { useEffect } from 'react';
import { AvatarRender } from '@/components/play/AvatarRender';
import type { AvatarShopListing } from '@/lib/db/shop';
import { lookupItem } from '@/lib/avatar/itemCatalog';

interface Props {
  open: boolean;
  listing: AvatarShopListing | null;
  coinBalance: number;
  pending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurchaseConfirmDialog({
  open,
  listing,
  coinBalance,
  pending,
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending, onCancel]);

  if (!open || !listing) return null;

  const { shopItem, avatarItem } = listing;
  const catalogItem = lookupItem(avatarItem.unlockRef);
  const previewEquipped = catalogItem
    ? { [catalogItem.slot]: catalogItem.unlockRef }
    : undefined;
  const balanceAfter = coinBalance - shopItem.priceCoins;
  const canAfford = balanceAfter >= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={pending ? undefined : onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border-4 border-amber-800/60 bg-amber-50 p-5 shadow-2xl"
      >
        <h2
          id="purchase-dialog-title"
          className="text-center text-xl font-extrabold text-amber-950"
        >
          买这个？
        </h2>

        <div className="mt-4 flex flex-col items-center gap-2">
          <AvatarRender
            equipped={previewEquipped}
            size={128}
            label={shopItem.name}
          />
          <div className="text-lg font-bold text-amber-950">{shopItem.name}</div>
          {shopItem.description && (
            <div className="px-4 text-center text-sm text-amber-900/70">
              {shopItem.description}
            </div>
          )}
        </div>

        <dl className="mt-4 space-y-1.5 rounded-xl bg-amber-100/60 px-4 py-3 text-sm font-semibold text-amber-950">
          <div className="flex justify-between">
            <dt>价格</dt>
            <dd>🪙 {shopItem.priceCoins}</dd>
          </div>
          <div className="flex justify-between">
            <dt>现在金币</dt>
            <dd>🪙 {coinBalance}</dd>
          </div>
          <div
            className={[
              'flex justify-between border-t border-amber-800/20 pt-1.5',
              canAfford ? 'text-amber-950' : 'text-red-700',
            ].join(' ')}
          >
            <dt>买了之后</dt>
            <dd>🪙 {Math.max(balanceAfter, 0)}</dd>
          </div>
        </dl>

        {!canAfford && (
          <div className="mt-3 text-center text-sm font-semibold text-red-700">
            再赚 {shopItem.priceCoins - coinBalance} 个金币就能买啦！
          </div>
        )}
        {errorMessage && canAfford && (
          <div className="mt-3 text-center text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-xl border-2 border-amber-800/40 bg-amber-50 py-3 text-base font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            再想想
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || !canAfford}
            className="flex-1 rounded-xl border-2 border-amber-900 bg-amber-700 py-3 text-base font-extrabold text-amber-50 shadow-md hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {pending ? '...买中' : `买 🪙 ${shopItem.priceCoins}`}
          </button>
        </div>
      </div>
    </div>
  );
}
