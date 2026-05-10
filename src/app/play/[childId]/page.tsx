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
          <h1 className="text-2xl font-bold">{child.displayName}&apos;s map</h1>
          <p className="text-sm text-zinc-600">
            {playableWeeks.length} level{playableWeeks.length === 1 ? '' : 's'}{' '}
            ready
          </p>
        </div>
        <span className="rounded-full bg-amber-200 px-4 py-1 text-base font-bold text-amber-900">
          🪙 {balance.balance}
        </span>
      </section>

      {playableWeeks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-amber-300 bg-white/60 p-8 text-center text-sm text-zinc-600">
          <p className="font-medium">No levels yet.</p>
          <p className="mt-1">
            A parent needs to publish a week first. Go to{' '}
            <Link
              href="/parent/stage/new"
              className="text-blue-600 underline"
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
                  className="flex items-center justify-between rounded-2xl border-2 border-white bg-white/80 p-4 shadow-sm transition-transform hover:scale-[1.01]"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={[
                        'flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold',
                        done
                          ? 'bg-emerald-400 text-white'
                          : 'bg-sky-200 text-sky-900',
                      ].join(' ')}
                    >
                      {done ? '★' : w.weekNumber}
                    </span>
                    <span>
                      <p className="text-base font-semibold text-zinc-800">
                        {w.label}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {pct}% complete
                      </p>
                    </span>
                  </span>
                  <span className="text-2xl">▶</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
