import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getShopPageData } from '@/lib/db/shop';
import { ShopBody } from './ShopBody';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function ShopPage({ params }: PageProps) {
  const { childId } = await params;
  try {
    await requireChild(childId);
  } catch {
    notFound();
  }

  const { listings, ownedShopItemIds, equipped, coinBalance } =
    await getShopPageData(childId);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <ShopBody
        childId={childId}
        initialCoinBalance={coinBalance}
        listings={listings}
        initialOwnedShopItemIds={ownedShopItemIds}
        initialEquipped={equipped}
      />
    </main>
  );
}
