import { AtlasHallCard } from './AtlasHallCard';
import type { PackUiMeta } from '@/lib/collections/packRegistry';

export interface AtlasHallSummary {
  packSlug: string;
  meta: PackUiMeta;
  ownedCount: number;
  totalCount: number;
}

interface Props {
  childId: string;
  halls: AtlasHallSummary[];
}

export function AtlasHub({ childId, halls }: Props) {
  const totalOwned = halls.reduce((s, h) => s + h.ownedCount, 0);
  const totalItems = halls.reduce((s, h) => s + h.totalCount, 0);

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <header className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-5 text-center text-amber-900">
        <div className="text-4xl" aria-hidden="true">
          🏛️
        </div>
        <h1 className="mt-1 font-hanzi text-2xl font-extrabold">收藏馆</h1>
        <p className="text-base font-semibold">Collector&apos;s Atlas</p>
        <p className="mt-2 text-sm">
          {totalOwned} / {totalItems} · 各种系列等你来收集！
        </p>
        <p className="text-xs italic opacity-80">
          Many collections to discover!
        </p>
      </header>
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
      </ul>
    </div>
  );
}
