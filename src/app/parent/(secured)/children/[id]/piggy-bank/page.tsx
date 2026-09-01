import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PiggyBankPanel } from '@/components/parent/PiggyBankPanel';
import { requireChild } from '@/lib/auth/guards';
import { getPiggyBalance, getPiggyTotals, listPiggyEntries } from '@/lib/db/piggy';
import { previewPastProgress } from '@/lib/db/piggy-backfill';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PiggyBankPage({ params }: PageProps) {
  const { id } = await params;

  let child;
  try {
    ({ child } = await requireChild(id));
  } catch {
    notFound();
  }

  const [balancePence, totals, entries, preview] = await Promise.all([
    getPiggyBalance(child.id),
    getPiggyTotals(child.id),
    listPiggyEntries(child.id, 100),
    previewPastProgress(child.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          {child.displayName}&apos;s Piggy Bank
        </h1>
        <Link
          href={`/parent/children/${child.id}`}
          className="text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          ← Back
        </Link>
      </header>

      <PiggyBankPanel
        childId={child.id}
        childName={child.displayName}
        enabled={child.piggyBankEnabled}
        balancePence={balancePence}
        totals={totals}
        entries={entries.map((e) => ({
          id: e.id,
          deltaPence: e.deltaPence,
          source: e.source,
          category: e.category,
          note: e.note,
          occurredAt: e.occurredAt.toISOString(),
        }))}
        preview={preview}
      />
    </main>
  );
}
