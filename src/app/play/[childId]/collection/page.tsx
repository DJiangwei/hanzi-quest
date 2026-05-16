// src/app/play/[childId]/collection/page.tsx
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getCoinBalance } from '@/lib/db/coins';
import {
  getPackBySlug,
  listChildCollection,
} from '@/lib/db/collections';
import { CollectionPageBody } from '@/components/play/CollectionPageBody';
import { ZodiacIconDefs, type ZodiacSlug } from '@/components/play/zodiac-icons';

const ZODIAC_PACK_SLUG = 'zodiac-v1';

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  const pack = await getPackBySlug(ZODIAC_PACK_SLUG);
  if (!pack) notFound();

  const [collection, balance] = await Promise.all([
    listChildCollection(childId, pack.id),
    getCoinBalance(childId),
  ]);

  const ownedSlugs = collection.map((c) => c.slug as ZodiacSlug);

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-6">
      <ZodiacIconDefs />
      <CollectionPageBody
        childId={childId}
        packSlug={ZODIAC_PACK_SLUG}
        ownedSlugs={ownedSlugs}
        balance={balance.balance}
      />
    </main>
  );
}
