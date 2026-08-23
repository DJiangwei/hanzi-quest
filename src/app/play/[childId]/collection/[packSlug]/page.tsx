// src/app/play/[childId]/collection/[packSlug]/page.tsx
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getCoinBalance } from '@/lib/db/coins';
import {
  getPackBySlug,
  listChildCollection,
  listPackItems,
} from '@/lib/db/collections';
import { listCrewMates, listCrewOwnershipForPack } from '@/lib/db/crew';
import { countGiftsSentToday } from '@/lib/db/gifts';
import { getGlobalShards } from '@/lib/db/grants';
import { todayUtcIso } from '@/lib/db/streaks';
import { PackPageBody } from '@/components/play/PackPageBody';
import { getPackMeta } from '@/lib/collections/packRegistry';

interface PageProps {
  params: Promise<{ childId: string; packSlug: string }>;
}

export default async function PackPage({ params }: PageProps) {
  const { childId, packSlug } = await params;
  await requireChild(childId);

  const pack = await getPackBySlug(packSlug);
  // `meta` here is server-side: we validate the slug is registered so that
  // unknown packs 404 instead of crashing inside the client child. The client
  // re-resolves the meta from the slug itself (see PackPageBody) — RSC can't
  // serialise the ItemCard / resolveRevealEmoji functions across the
  // server→client boundary.
  const meta = getPackMeta(packSlug);
  if (!pack || !meta) notFound();

  const [items, owned, balance, shardCount, crew, giftsSentToday] = await Promise.all([
    listPackItems(pack.id),
    listChildCollection(childId, pack.id),
    getCoinBalance(childId),
    getGlobalShards(childId),
    listCrewMates(childId),
    countGiftsSentToday(childId, todayUtcIso()),
  ]);

  const ownedItemIds = owned.map((o) => o.id);
  const ownersByItem = await listCrewOwnershipForPack(
    pack.id,
    crew.map((m) => m.childId),
  );

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-6">
      <PackPageBody
        childId={childId}
        packSlug={packSlug}
        items={items}
        ownedItemIds={ownedItemIds}
        ownedItems={owned}
        balance={balance.balance}
        shardCount={shardCount}
        crew={crew}
        ownersByItem={ownersByItem}
        giftsSentToday={giftsSentToday}
      />
    </main>
  );
}
