import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getShopPageData, listSoundThemeListings } from '@/lib/db/shop';
import { getChildSettings } from '@/lib/db/settings';
import { listPetShopListings, getEquippedPet } from '@/lib/db/pets';
import { listDecorShopListings } from '@/lib/db/decor';
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

  const [shop, sounds, settings, petListings, equippedPet, decorListings] = await Promise.all([
    getShopPageData(childId),
    listSoundThemeListings(),
    getChildSettings(childId),
    listPetShopListings(),
    getEquippedPet(childId),
    listDecorShopListings(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <ShopBody
        childId={childId}
        initialCoinBalance={shop.coinBalance}
        listings={shop.listings}
        initialOwnedShopItemIds={shop.ownedShopItemIds}
        initialEquipped={shop.equipped}
        soundListings={sounds}
        initialEquippedSoundThemeSlug={settings?.soundThemeSlug ?? null}
        petListings={petListings}
        initialEquippedPetSlug={equippedPet?.slug ?? null}
        decorListings={decorListings}
      />
    </main>
  );
}
