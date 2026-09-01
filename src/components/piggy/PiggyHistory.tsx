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
    <section
      data-testid="piggy-history"
      className="overflow-hidden rounded-2xl bg-white/70"
    >
      {/*
        A two-column ledger, debit/credit style: money in on the left column,
        money out on the right, one chronological timeline down the middle. The
        column carries the sign, so a spend is written £4.50 and NOT -£4.50 —
        a six-year-old should not have to read a minus to learn something the
        heading already told her.
      */}
      <div
        data-testid="piggy-ledger-head"
        className="grid grid-cols-[1fr_4.25rem_4.25rem] gap-1 border-b border-[var(--color-sand-200)] px-3 py-1.5 text-[10px] font-bold leading-tight text-[var(--color-sand-700)]"
      >
        <span />
        <span className="text-right">
          <span className="font-hanzi block">收入</span>
          <span className="block italic opacity-80">In</span>
        </span>
        <span className="text-right">
          <span className="font-hanzi block">支出</span>
          <span className="block italic opacity-80">Out</span>
        </span>
      </div>

      <ul>
        {entries.map((e) => {
          const cat = e.category ? getPiggyCategory(e.category) : null;
          const label = SOURCE_LABEL[e.source] ?? {
            emoji: '✨',
            zh: '记录',
            en: 'Entry',
          };
          const isCredit = e.deltaPence >= 0;
          const amount = formatPence(Math.abs(e.deltaPence));

          return (
            <li
              key={e.id}
              data-testid={`piggy-entry-${e.id}`}
              className="grid grid-cols-[1fr_4.25rem_4.25rem] items-center gap-1 border-b border-[var(--color-sand-200)]/60 px-3 py-2 text-xs last:border-b-0"
            >
              <span className="flex items-center gap-2 leading-tight">
                <span className="text-base" aria-hidden="true">
                  {cat?.emoji ?? label.emoji}
                </span>
                <span className="min-w-0">
                  <span className="font-hanzi block truncate text-[var(--color-sand-900)]">
                    {e.note || (cat ? cat.zh : label.zh)}
                  </span>
                  <span className="block truncate text-[10px] italic text-[var(--color-sand-700)]">
                    {cat ? cat.en : label.en}
                  </span>
                  <span className="block text-[10px] text-[var(--color-sand-700)]">
                    {e.occurredAt.slice(0, 10)}
                  </span>
                </span>
              </span>

              <span
                data-testid={`piggy-in-${e.id}`}
                className="text-right font-bold tabular-nums"
                style={{ color: isCredit ? 'var(--color-good)' : undefined }}
              >
                {isCredit ? amount : <span aria-hidden="true">—</span>}
              </span>

              <span
                data-testid={`piggy-out-${e.id}`}
                className="text-right font-bold tabular-nums"
                style={{ color: isCredit ? undefined : 'var(--color-bad)' }}
              >
                {isCredit ? <span aria-hidden="true">—</span> : amount}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
