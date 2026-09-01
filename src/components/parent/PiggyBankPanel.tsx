'use client';

import { useState, useTransition } from 'react';
import {
  addPiggyCreditAction,
  deletePiggyEntryAction,
  recordPiggyPurchaseAction,
  reconcilePiggyAction,
  setPiggyEnabledAction,
} from '@/lib/actions/piggy';
import { PIGGY_CATEGORIES, getPiggyCategory } from '@/lib/piggy/categories';
import { formatPence } from '@/lib/piggy/money';
import { PIGGY_MANUAL_SOURCES } from '@/lib/piggy/sources';

export interface PanelEntry {
  id: string;
  deltaPence: number;
  source: string;
  category: string | null;
  note: string | null;
  occurredAt: string; // ISO — Dates do not cross the RSC boundary cleanly
}

interface Props {
  childId: string;
  childName: string;
  enabled: boolean;
  balancePence: number;
  /** Lifetime earned / spent, both positive. */
  totals: { earnedPence: number; spentPence: number };
  entries: PanelEntry[];
  preview: {
    totalPence: number;
    bossClears: number;
    vaults: number;
    finalBosses: number;
  };
}

const DELETABLE = new Set<string>(PIGGY_MANUAL_SOURCES);

export function PiggyBankPanel({
  childId,
  childName,
  enabled,
  balancePence,
  totals,
  entries,
  preview,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      try {
        const res = await fn();
        setMessage(res.ok ? okMsg : `Failed: ${res.error ?? 'unknown error'}`);
      } catch (err) {
        // A thrown action (e.g. zod rejecting a note over 200 chars) must
        // surface here, not as an unhandled rejection inside the transition.
        setMessage(`Failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    });
  }

  if (!enabled) {
    return (
      <section
        data-testid="piggy-disabled"
        className="flex flex-col gap-3 rounded-2xl border border-[var(--color-sand-200)] bg-white/60 p-4"
      >
        <h2 className="text-sm font-bold text-[var(--color-ocean-900)]">
          🐷 Piggy Bank
        </h2>
        <p className="text-xs text-[var(--color-sand-700)]">
          Off. When on, {childName} earns real pocket money for beating bosses:
          £1 per weekly boss, £1 for opening a map&apos;s vault, £3 for a final
          boss, plus up to £3 across a season.
        </p>
        <p className="text-sm font-semibold text-[var(--color-ocean-900)]">
          Turning this on will credit {formatPence(preview.totalPence)} of past
          progress ({preview.bossClears} boss clears · {preview.vaults} vaults ·{' '}
          {preview.finalBosses} final bosses).
        </p>
        <button
          type="button"
          disabled={pending}
          data-testid="piggy-enable"
          onClick={() =>
            startTransition(async () => {
              try {
                const res = await setPiggyEnabledAction({ childId, enabled: true });
                setMessage(
                  `Enabled — credited ${formatPence(res.creditedPence)} across ${res.entries} entries.`,
                );
              } catch (err) {
                setMessage(`Failed: ${err instanceof Error ? err.message : 'unknown error'}`);
              }
            })
          }
          className="self-start rounded-full bg-[var(--color-ocean-700)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Turn on &amp; credit past progress
        </button>
        {message && <p className="text-xs text-[var(--color-sand-700)]">{message}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-sand-200)] bg-white/60 p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-[var(--color-ocean-900)]">
          🐷 Piggy Bank
        </h2>
        <span data-testid="piggy-balance" className="text-2xl font-bold text-[var(--color-ocean-900)]">
          {formatPence(balancePence)}
        </span>
      </header>

      <p data-testid="piggy-totals" className="text-xs text-[var(--color-sand-700)]">
        Money in {formatPence(totals.earnedPence)} lifetime · money out{' '}
        {formatPence(totals.spentPence)}.
      </p>

      <p className="text-xs text-[var(--color-sand-700)]">
        This balance mirrors the real jar. Handing {childName} cash is not a
        transaction — it moves the same money from virtual to physical. Only
        purchases reduce the balance.
      </p>

      <form
        data-testid="piggy-add-form"
        action={(fd) =>
          run(
            () =>
              addPiggyCreditAction({
                childId,
                pounds: String(fd.get('pounds') ?? ''),
                note: String(fd.get('note') ?? ''),
                occurredAt: String(fd.get('date') ?? ''),
              }),
            'Money added.',
          )
        }
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-sand-200)] pt-3"
      >
        <label className="flex flex-col text-xs font-semibold">
          Add money (£)
          <input name="pounds" inputMode="decimal" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Note
          <input name="note" className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Date
          <input name="date" type="date" className="rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          Add
        </button>
      </form>

      <form
        data-testid="piggy-purchase-form"
        action={(fd) =>
          run(
            () =>
              recordPiggyPurchaseAction({
                childId,
                pounds: String(fd.get('pounds') ?? ''),
                category: String(fd.get('category') ?? ''),
                note: String(fd.get('note') ?? ''),
                occurredAt: String(fd.get('date') ?? ''),
              }),
            'Purchase recorded.',
          )
        }
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-sand-200)] pt-3"
      >
        <label className="flex flex-col text-xs font-semibold">
          Spent (£)
          <input name="pounds" inputMode="decimal" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          On
          <select name="category" required className="rounded border px-2 py-1">
            {PIGGY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.en}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Note
          <input name="note" className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs font-semibold">
          Date
          <input name="date" type="date" className="rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          Record
        </button>
      </form>

      <form
        data-testid="piggy-reconcile-form"
        action={(fd) =>
          run(
            () =>
              reconcilePiggyAction({
                childId,
                actualPounds: String(fd.get('actual') ?? ''),
              }),
            'Reconciled.',
          )
        }
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-sand-200)] pt-3"
      >
        <label className="flex flex-col text-xs font-semibold">
          Actually in the jar (£)
          <input name="actual" inputMode="decimal" required className="rounded border px-2 py-1" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--color-ocean-700)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          Reconcile
        </button>
      </form>

      {message && (
        <p data-testid="piggy-message" className="text-xs text-[var(--color-sand-700)]">
          {message}
        </p>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-sand-700)]">
            <th className="py-1">Date</th>
            <th>What</th>
            <th className="text-right">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody data-testid="piggy-entry-table">
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-[var(--color-sand-200)]">
              <td className="py-1">{e.occurredAt.slice(0, 10)}</td>
              <td>
                {e.category ? `${getPiggyCategory(e.category)?.emoji ?? ''} ` : ''}
                {e.note || e.source.replace(/_/g, ' ')}
              </td>
              <td className={`text-right font-semibold ${e.deltaPence < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatPence(e.deltaPence)}
              </td>
              <td className="text-right">
                {DELETABLE.has(e.source) && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Delete entry from ${e.occurredAt.slice(0, 10)}`}
                    onClick={() =>
                      run(
                        () => deletePiggyEntryAction({ childId, entryId: e.id }),
                        'Entry deleted.',
                      )
                    }
                    className="text-rose-700 hover:underline disabled:opacity-50"
                  >
                    delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        disabled={pending}
        data-testid="piggy-disable"
        onClick={() =>
          run(
            () => setPiggyEnabledAction({ childId, enabled: false }).then(() => ({ ok: true })),
            'Turned off. History kept.',
          )
        }
        className="self-start text-xs text-[var(--color-sand-700)] underline"
      >
        Turn off (history is kept)
      </button>
    </section>
  );
}
