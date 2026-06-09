import Link from 'next/link';
import { AtlasHallCard } from './AtlasHallCard';
import { RecentlyObtainedStrip } from './RecentlyObtainedStrip';
import type { PackUiMeta } from '@/lib/collections/packRegistry';
import type { RecentItem } from '@/lib/db/recent-obtained';

export interface AtlasHallSummary {
  packSlug: string;
  meta: PackUiMeta;
  ownedCount: number;
  totalCount: number;
}

interface Props {
  childId: string;
  halls: AtlasHallSummary[];
  recentItems?: RecentItem[];
  /** Server-computed reference time for the "NEW" sticker cutoff in the strip. */
  nowMs?: number;
}

export function AtlasHub({ childId, halls, recentItems = [], nowMs = 0 }: Props) {
  const totalOwned = halls.reduce((s, h) => s + h.ownedCount, 0);
  const totalItems = halls.reduce((s, h) => s + h.totalCount, 0);

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <header className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-5 text-center text-amber-900">
        <div className="text-4xl" aria-hidden="true">
          🎒
        </div>
        <h1 className="mt-1 font-hanzi text-2xl font-extrabold">背包</h1>
        <p className="text-base font-semibold">Backpack</p>
        <p className="mt-2 text-sm">
          {totalOwned} / {totalItems} · 各种系列等你来收集！
        </p>
        <p className="text-xs italic opacity-80">
          Many collections to discover!
        </p>
      </header>
      <RecentlyObtainedStrip items={recentItems} nowMs={nowMs} />
      <ul className="flex flex-col gap-3" data-testid="atlas-hall-list">
        {halls.map((hall) => (
          <li key={hall.packSlug}>
            <AtlasHallCard
              childId={childId}
              packSlug={hall.packSlug}
              meta={hall.meta}
              ownedCount={hall.ownedCount}
              totalCount={hall.totalCount}
            />
          </li>
        ))}
        <li>
          <Link
            href={`/play/${childId}/collection/story-library`}
            data-testid="atlas-hall-story-library"
            className="group block rounded-3xl border-2 border-amber-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start gap-4 rounded-t-[1.4rem] bg-gradient-to-br from-amber-100 via-orange-200 to-rose-200 p-5">
              <div className="text-5xl drop-shadow-sm" aria-hidden="true">
                📖
              </div>
              <div className="flex-1">
                <h2 className="font-hanzi text-2xl font-extrabold leading-tight text-amber-950">
                  故事书
                </h2>
                <p className="text-sm font-semibold text-amber-900">
                  Story Library
                </p>
                <p className="mt-1 text-xs text-amber-900/80">
                  船长伊诺的航海日志。
                </p>
                <p className="text-[11px] italic text-amber-900/70">
                  Captain Yinuo&apos;s chapters.
                </p>
              </div>
            </div>
            <div className="rounded-b-[1.4rem] bg-white/90 px-5 py-3">
              <div className="flex items-center justify-end gap-3">
                <span className="text-sm font-bold text-amber-900 transition group-hover:translate-x-0.5">
                  进入 / Open →
                </span>
              </div>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
