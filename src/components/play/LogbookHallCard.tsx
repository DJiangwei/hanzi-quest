import Link from 'next/link';

interface Props {
  childId: string;
  totalCount: number;
  proficientCount: number;
}

/**
 * Backpack entry to the 航海日志. Rendered beside TrophiesHallCard rather than
 * through PACK_REGISTRY: the Logbook is 1:1 with the curriculum and has no
 * rarity, no duplicates and no shard economy, so pack semantics buy nothing.
 */
export function LogbookHallCard({ childId, totalCount, proficientCount }: Props) {
  return (
    <Link
      href={`/play/${childId}/collection/logbook`}
      data-testid="atlas-hall-logbook"
      className="group block rounded-3xl border-2 border-sky-400 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4 rounded-t-[1.4rem] bg-gradient-to-br from-sky-200 via-sky-300 to-sky-400 p-5">
        <div className="text-5xl drop-shadow-sm" aria-hidden>📖</div>
        <div className="flex-1">
          <h2 className="font-hanzi text-2xl font-extrabold leading-tight text-sky-950">航海日志</h2>
          <p className="text-sm font-semibold text-sky-900">Captain&apos;s Logbook</p>
          <p className="mt-1 text-xs text-sky-900/80">你认识的每一个字,都记在这里。</p>
          <p className="text-[11px] italic text-sky-900/70">Every character you have met.</p>
        </div>
      </div>
      <div className="rounded-b-[1.4rem] bg-white/90 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-stone-700">
            <span className="font-hanzi">{totalCount} 个字</span>
            <span className="text-stone-500"> · {totalCount} characters</span>
            <div className="text-[11px] font-normal text-stone-500">
              <span className="font-hanzi">熟练 {proficientCount}</span>
              <span className="italic"> / {proficientCount} solid</span>
            </div>
          </div>
          <span className="text-sm font-bold text-sky-900 transition group-hover:translate-x-0.5">
            打开 / Open →
          </span>
        </div>
      </div>
    </Link>
  );
}
