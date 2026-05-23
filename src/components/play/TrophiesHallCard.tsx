import Link from 'next/link';

interface Props {
  childId: string;
  earnedCount: number;
  totalCount: number;
}

export function TrophiesHallCard({ childId, earnedCount, totalCount }: Props) {
  const pct = totalCount === 0 ? 0 : Math.round((earnedCount / totalCount) * 100);
  return (
    <Link
      href={`/play/${childId}/trophies`}
      data-testid="atlas-hall-trophies"
      className="group block rounded-3xl border-2 border-amber-400 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4 rounded-t-[1.4rem] bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 p-5">
        <div className="text-5xl drop-shadow-sm" aria-hidden>🏆</div>
        <div className="flex-1">
          <h2 className="font-hanzi text-2xl font-extrabold leading-tight text-amber-950">荣誉殿堂</h2>
          <p className="text-sm font-semibold text-amber-900">Hall of Trophies</p>
          <p className="mt-1 text-xs text-amber-900/80">收集你的每一项成就。</p>
          <p className="text-[11px] italic text-amber-900/70">Collect every achievement.</p>
        </div>
      </div>
      <div className="rounded-b-[1.4rem] bg-white/90 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div
              className="h-2 overflow-hidden rounded-full bg-stone-200"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`荣誉殿堂 进度 ${pct}%`}
            >
              <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-xs font-semibold text-stone-700">
              {earnedCount} / {totalCount} ·{' '}
              <span className="text-stone-500">{pct}%</span>
            </div>
          </div>
          <span className="text-sm font-bold text-amber-900 transition group-hover:translate-x-0.5">
            进入 →
          </span>
        </div>
      </div>
    </Link>
  );
}
