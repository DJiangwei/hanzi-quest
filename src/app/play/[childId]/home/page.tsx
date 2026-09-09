import { requireChild } from '@/lib/auth/guards';
import { getHomeState } from '@/lib/db/home';
import { getRoomSurfaces } from '@/lib/db/home-surfaces';
import { getCoinBalance } from '@/lib/db/coins';
import { listShopItemsByKind } from '@/lib/db/shop';
import { getSurface } from '@/lib/home/surfaces';
import { HomeRoomView } from '@/components/home/HomeRoomView';
import { HomeViewSwitch } from '@/components/home3d/HomeViewSwitch';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const [{ ownedSlugs, placements }, roomSurfaces, coinBalance, homeShopItems] = await Promise.all([
    getHomeState(child.id),
    getRoomSurfaces(child.id),
    getCoinBalance(child.id).then((b) => b.balance),
    listShopItemsByKind('home'),
  ]);
  // Owned slugs include all kind='home' purchases; surfaces are the ones in the catalog.
  const ownedSurfaceSlugs = ownedSlugs.filter((s) => getSurface(s) !== undefined);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 lg:max-w-4xl">
      <h1 className="font-hanzi text-2xl font-bold tracking-tight text-[var(--color-ocean-900)]">
        🏠 我的家 / My Home
      </h1>

      {ownedSlugs.length === 0 ? (
        // An empty room, not a dead end. Buying and placing are one act now
        // (a shop tap routes straight into this room with the piece
        // ghosted), so a child with nothing yet must still land IN the room
        // — an empty-state screen with only a link back to the shop closed
        // the loop: shop → room → empty state → shop, with no way to ever
        // place a first piece. The encouraging copy stays, above the room,
        // rather than replacing it.
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-sunset-400)] bg-white/70 p-4 text-center text-sm text-[var(--color-sand-900)]">
          <p className="font-semibold">
            <span aria-hidden>🛋️</span> 家里还没有家具，去下面摆第一件吧 / No furniture
            yet — place your first piece below
          </p>
        </div>
      ) : null}
      <HomeViewSwitch
        childId={child.id}
        twoD={
          <HomeRoomView
            childId={child.id}
            ownedSlugs={ownedSlugs}
            placements={placements}
            roomSurfaces={roomSurfaces}
            ownedSurfaceSlugs={ownedSurfaceSlugs}
          />
        }
        placements={placements}
        roomSurfaces={roomSurfaces}
        ownedSlugs={ownedSlugs}
        homeShopItems={homeShopItems}
        coinBalance={coinBalance}
      />
    </main>
  );
}
