import { redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { PiggyJar } from '@/components/piggy/PiggyJar';
import { PiggyBreakdown } from '@/components/piggy/PiggyBreakdown';
import { PiggyHistory } from '@/components/piggy/PiggyHistory';
import {
  getPiggyBalance,
  getPiggyTotals,
  getSpendByCategory,
  isPiggyEnabled,
  listPiggyEntries,
} from '@/lib/db/piggy';
import { getActiveSeason } from '@/lib/db/season';
import { formatPence } from '@/lib/piggy/money';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function PiggyBankPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  // Disabled is not an error state — the child simply has no piggy bank.
  if (!(await isPiggyEnabled(child.id))) redirect(`/play/${child.id}`);

  const [balancePence, entries, spendByCategory, season] = await Promise.all([
    getPiggyBalance(child.id),
    listPiggyEntries(child.id, 50),
    getSpendByCategory(child.id),
    getActiveSeason(),
  ]);

  const seasonSummary = season
    ? await getPiggyTotals(child.id, { from: season.startsAt, to: season.endsAt })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <PiggyJar balancePence={balancePence} />

      {seasonSummary && (
        <section
          data-testid="piggy-season-panel"
          className="rounded-2xl bg-white/70 p-3 text-xs"
        >
          <h2 className="font-bold text-[var(--color-sand-700)]">
            <span className="font-hanzi">本季</span>{' '}
            <span className="font-normal italic text-[var(--color-sand-700)]/80">
              / This season
            </span>
          </h2>
          <p className="mt-1 text-[var(--color-sand-900)]">
            <span className="font-hanzi">赚了</span>{' '}
            <span className="font-bold" style={{ color: 'var(--color-good)' }}>
              {formatPence(seasonSummary.earnedPence)}
            </span>
            {' · '}
            <span className="font-hanzi">花了</span>{' '}
            <span className="font-bold" style={{ color: 'var(--color-bad)' }}>
              {formatPence(seasonSummary.spentPence)}
            </span>
          </p>
          <p className="text-[10px] italic text-[var(--color-sand-700)]">
            Earned {formatPence(seasonSummary.earnedPence)} · spent{' '}
            {formatPence(seasonSummary.spentPence)}
          </p>
        </section>
      )}

      <PiggyBreakdown spendByCategory={spendByCategory} />

      <PiggyHistory
        entries={entries.map((e) => ({
          id: e.id,
          deltaPence: e.deltaPence,
          source: e.source,
          category: e.category,
          note: e.note,
          occurredAt: e.occurredAt.toISOString(),
        }))}
      />
    </main>
  );
}
