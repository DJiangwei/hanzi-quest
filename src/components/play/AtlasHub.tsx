import { AtlasHallCard } from './AtlasHallCard';
import { RecentlyObtainedStrip } from './RecentlyObtainedStrip';
import type { PackUiMeta } from '@/lib/collections/packRegistry';
import type { RecentItem } from '@/lib/db/recent-obtained';
import { SHARD_SWAP_COST } from '@/lib/economy/shards';

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
  /** E1: global shard wallet — a swap-ready balance gets a wake-up banner. */
  shards?: number;
}

export function AtlasHub({ childId, halls, recentItems = [], nowMs = 0, shards = 0 }: Props) {
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
      {shards >= SHARD_SWAP_COST && (
        <div
          data-testid="shard-nudge"
          className="rounded-2xl border-2 border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-100 p-3 text-center text-sky-900 shadow-sm"
        >
          <p className="font-hanzi text-sm font-extrabold">
            💠 你有 {shards} 枚碎片 — 还能换 {Math.floor(shards / SHARD_SWAP_COST)} 张新卡!
          </p>
          <p className="text-xs opacity-80">
            {shards} shards — swap them for {Math.floor(shards / SHARD_SWAP_COST)} new cards! Open
            any pack below and tap 换卡.
          </p>
        </div>
      )}
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
        {/* Story Library card hidden 2026-06-13 — story-mode ZH text quality not
            yet up to par; route + data retained for re-enable. */}
      </ul>
    </div>
  );
}
