import Link from 'next/link';
import { requireChild } from '@/lib/auth/guards';
import { getCoinBalance } from '@/lib/db/coins';
import { listProgressByChild } from '@/lib/db/play';
import { listChildPlayableWeeks } from '@/lib/db/weeks';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function PlayHomePage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const [playableWeeks, progressRows, balance] = await Promise.all([
    listChildPlayableWeeks(child.id),
    listProgressByChild(child.id),
    getCoinBalance(child.id),
  ]);

  const progressByWeek = new Map(
    progressRows.map((p) => [p.weekId, p.completionPercent]),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <section className="flex items-end justify-between">
        <div>
          <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
            {child.displayName} 的航海图
          </h1>
          <p className="text-sm text-[var(--color-sand-700)]">
            {playableWeeks.length} island{playableWeeks.length === 1 ? '' : 's'}{' '}
            ready to explore
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-treasure-400)] px-4 py-1.5 text-lg font-bold text-[var(--color-treasure-700)] shadow-md">
          <span className="text-xl">🪙</span>
          {balance.balance}
        </span>
      </section>

      {playableWeeks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-sunset-400)] bg-white/70 p-8 text-center text-sm text-[var(--color-sand-900)]">
          <p className="font-semibold">No islands yet, captain.</p>
          <p className="mt-1 text-[var(--color-sand-700)]">
            A parent needs to publish a week first. Visit{' '}
            <Link
              href="/parent/stage/new"
              className="font-semibold text-[var(--color-ocean-700)] underline"
            >
              parent dashboard
            </Link>
            .
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {playableWeeks.map((w) => {
            const pct = progressByWeek.get(w.id) ?? 0;
            const done = pct >= 100;
            return (
              <li key={w.id}>
                <Link
                  href={`/play/${childId}/level/${w.id}`}
                  className="flex items-center justify-between rounded-2xl border-2 border-white bg-white/85 p-4 shadow-md transition-transform hover:scale-[1.015] active:scale-95"
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={[
                        'flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold shadow-inner',
                        done
                          ? 'bg-[var(--color-treasure-400)] text-[var(--color-treasure-700)]'
                          : 'bg-[var(--color-ocean-300)] text-[var(--color-ocean-900)]',
                      ].join(' ')}
                    >
                      {done ? '⭐' : w.weekNumber}
                    </span>
                    <span>
                      <p className="font-hanzi text-lg font-bold text-[var(--color-ocean-900)]">
                        {w.label}
                      </p>
                      <p className="text-xs text-[var(--color-sand-700)]">
                        {pct}% complete
                      </p>
                    </span>
                  </span>
                  <span className="text-2xl text-[var(--color-sunset-500)]">
                    ▶
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
