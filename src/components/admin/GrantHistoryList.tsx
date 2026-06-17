'use client';

import { useState } from 'react';
import { undoAdminGiftAction } from '@/lib/actions/admin';

interface GrantRow {
  id: string;
  adminUserId: string;
  bundle: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string; // ISO string
  undoneAt: string | null; // ISO string or null
}

interface Props {
  grants: GrantRow[];
}

function bundleSummary(bundle: Record<string, unknown>): string {
  const parts: string[] = [];
  if (bundle.coins != null) parts.push(`🪙 ${bundle.coins}`);
  if (bundle.xp != null) parts.push(`⭐ ${bundle.xp} XP`);
  if (bundle.shards != null) parts.push(`🔹 ${bundle.shards}`);
  if (bundle.giftPack) parts.push('🎁 Gift Pack');
  const cardIds = bundle.cardItemIds as string[] | undefined;
  if (cardIds && cardIds.length > 0) parts.push(`🎴 ${cardIds.length} cards`);
  const shopIds = bundle.shopItemIds as string[] | undefined;
  if (shopIds && shopIds.length > 0) parts.push(`🛒 ${shopIds.length} items`);
  const unlockAll = bundle.shopUnlockAll as string[] | undefined;
  if (unlockAll && unlockAll.length > 0) parts.push(`🔓 unlock all: ${unlockAll.join(', ')}`);
  return parts.length > 0 ? parts.join(' · ') : '(empty bundle)';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function GrantHistoryList({ grants }: Props) {
  const [undoState, setUndoState] = useState<
    Record<string, 'idle' | 'pending' | 'done' | 'error'>
  >({});

  async function handleUndo(grantId: string) {
    setUndoState((prev) => ({ ...prev, [grantId]: 'pending' }));
    try {
      const res = await undoAdminGiftAction(grantId);
      if (res.ok) {
        setUndoState((prev) => ({ ...prev, [grantId]: 'done' }));
      } else {
        setUndoState((prev) => ({ ...prev, [grantId]: 'error' }));
      }
    } catch {
      setUndoState((prev) => ({ ...prev, [grantId]: 'error' }));
    }
  }

  if (grants.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
          Grant History / 发放记录
        </h2>
        <p className="text-sm text-[var(--color-sand-600)]">
          No grants yet for this child.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="grant-history-list"
      className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        Grant History / 发放记录 ({grants.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {grants.map((grant) => {
          const alreadyUndone =
            grant.undoneAt != null ||
            undoState[grant.id] === 'done';
          const pending = undoState[grant.id] === 'pending';
          const hadError = undoState[grant.id] === 'error';

          return (
            <li
              key={grant.id}
              data-testid={`grant-row-${grant.id}`}
              className={`flex items-start justify-between gap-4 rounded-xl px-4 py-3 ${
                alreadyUndone
                  ? 'bg-[var(--color-sand-50)] opacity-50'
                  : 'bg-[var(--color-sand-50)]'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-mono text-[var(--color-sand-600)]">
                  {formatDate(grant.createdAt)}
                </span>
                <span className="text-sm text-[var(--color-sand-800)]">
                  {bundleSummary(grant.bundle)}
                </span>
                {alreadyUndone && (
                  <span className="text-xs font-semibold text-[var(--color-sand-500)]">
                    ✓ Undone
                  </span>
                )}
                {hadError && (
                  <span className="text-xs font-semibold text-red-500">
                    Undo failed — check server logs
                  </span>
                )}
              </div>
              <button
                data-testid={`btn-undo-${grant.id}`}
                onClick={() => handleUndo(grant.id)}
                disabled={alreadyUndone || pending}
                className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? '…' : '撤销 / Undo'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
