'use client';

import { getPiggyCategory } from '@/lib/piggy/categories';
import { formatPence } from '@/lib/piggy/money';

export interface HistoryEntry {
  id: string;
  deltaPence: number;
  source: string;
  category: string | null;
  note: string | null;
  /** ISO string — Dates do not cross the RSC boundary cleanly. */
  occurredAt: string;
}

interface Props {
  entries: HistoryEntry[];
}

const SOURCE_LABEL: Record<string, { emoji: string; zh: string; en: string }> = {
  boss_clear: { emoji: '⚔️', zh: '打败Boss', en: 'Boss defeated' },
  key_vault: { emoji: '💎', zh: '开启宝库', en: 'Vault opened' },
  final_boss: { emoji: '👑', zh: '打败霸主', en: 'Overlord defeated' },
  season_tier: { emoji: '🎗️', zh: '季票奖励', en: 'Season reward' },
  parent_credit: { emoji: '💷', zh: '存入', en: 'Added' },
  purchase: { emoji: '🛍️', zh: '花掉', en: 'Spent' },
  reconcile: { emoji: '⚖️', zh: '对账', en: 'Counted the jar' },
};

export function PiggyHistory({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p
        data-testid="piggy-history-empty"
        className="rounded-2xl bg-white/70 p-4 text-center text-xs text-[var(--color-sand-700)]"
      >
        <span className="font-hanzi">还没有记录</span>{' '}
        <span className="italic">/ Nothing yet</span>
      </p>
    );
  }

  return (
    <ul data-testid="piggy-history" className="flex flex-col gap-1.5">
      {entries.map((e) => {
        const cat = e.category ? getPiggyCategory(e.category) : null;
        const label = SOURCE_LABEL[e.source] ?? {
          emoji: '✨',
          zh: '记录',
          en: 'Entry',
        };
        const credit = e.deltaPence >= 0;
        return (
          <li
            key={e.id}
            data-testid={`piggy-entry-${e.id}`}
            className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs"
          >
            <span className="text-base" aria-hidden="true">
              {cat?.emoji ?? label.emoji}
            </span>
            <span className="flex-1 leading-tight">
              <span className="font-hanzi text-[var(--color-sand-900)]">
                {e.note || (cat ? cat.zh : label.zh)}
              </span>
              <span className="block text-[10px] italic text-[var(--color-sand-700)]">
                {cat ? cat.en : label.en}
              </span>
            </span>
            <span className="text-[10px] text-[var(--color-sand-700)]">
              {e.occurredAt.slice(0, 10)}
            </span>
            <span
              className="w-16 text-right font-bold"
              style={{ color: credit ? 'var(--color-good)' : 'var(--color-bad)' }}
            >
              {formatPence(e.deltaPence)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
