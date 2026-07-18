// src/app/play/[childId]/collection/page.tsx
import { requireChild } from '@/lib/auth/guards';
import {
  listActivePacks,
  listChildCollection,
  listPackItems,
} from '@/lib/db/collections';
import { AtlasHub, type AtlasHallSummary } from '@/components/play/AtlasHub';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { TrophiesHallCard } from '@/components/play/TrophiesHallCard';
import { listAllTrophies, listEarnedTrophies } from '@/lib/db/trophies';
import { getRecentlyObtainedForChild } from '@/lib/db/recent-obtained';
import { getGlobalShards } from '@/lib/db/grants';

export default async function CollectionAtlasPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  const [packs, allTrophies, earnedTrophies, recentItems, shards] = await Promise.all([
    listActivePacks(),
    listAllTrophies(),
    listEarnedTrophies(childId),
    getRecentlyObtainedForChild(childId, 3),
    getGlobalShards(childId),
  ]);
  const halls: AtlasHallSummary[] = (
    await Promise.all(
      packs.map(async (pack) => {
        const meta = getPackMeta(pack.slug);
        if (!meta) return null;
        const [items, owned] = await Promise.all([
          listPackItems(pack.id),
          listChildCollection(childId, pack.id),
        ]);
        return {
          packSlug: pack.slug,
          meta,
          ownedCount: owned.length,
          totalCount: items.length,
        };
      }),
    )
  ).filter((h): h is AtlasHallSummary => h !== null);

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-6">
      <AtlasHub
        childId={childId}
        halls={halls}
        recentItems={recentItems}
        shards={shards}
        // Server-side render-time snapshot for the "NEW" sticker cutoff in
        // RecentlyObtainedStrip. Each request re-renders so impurity is bounded.
        // eslint-disable-next-line react-hooks/purity
        nowMs={Date.now()}
      />
      <div className="w-full max-w-md">
        <TrophiesHallCard
          childId={childId}
          earnedCount={earnedTrophies.length}
          totalCount={allTrophies.length}
        />
      </div>
    </main>
  );
}
