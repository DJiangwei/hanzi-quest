'use client';

interface SwapDialogProps {
  open: boolean;
  onClose: () => void;
  itemNameZh: string;
  itemNameEn: string;
  shardCost: number;
  shardBalance: number;
  onConfirm: () => void;
}

export function SwapDialog({
  open,
  onClose,
  itemNameZh,
  itemNameEn,
  shardCost,
  shardBalance,
  onConfirm,
}: SwapDialogProps) {
  if (!open) return null;
  const canAfford = shardBalance >= shardCost;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-white px-6 py-5">
        <h2 className="text-lg font-bold text-stone-900">
          换取 / Trade for {itemNameZh} / {itemNameEn}?
        </h2>
        <div className="mt-2 text-sm text-stone-700">
          <p>
            需要 / Need {' '}
            <strong>
              <span>{shardCost}</span> 🔹
            </strong>{' '}
            碎片 / shards
          </p>
          <p>
            你现在有 / You have {' '}
            <strong>
              <span>{shardBalance}</span> 🔹
            </strong>{' '}
            / You have
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-stone-200 px-4 py-2 font-semibold text-stone-900"
          >
            取消 / Cancel
          </button>
          <button
            type="button"
            disabled={!canAfford}
            onClick={onConfirm}
            className={`flex-1 rounded-full px-4 py-2 font-semibold ${
              canAfford ? 'bg-sky-500 text-white' : 'bg-stone-300 text-stone-500'
            }`}
          >
            换! / Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
