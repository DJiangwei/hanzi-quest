import Link from 'next/link';
import { requireChild } from '@/lib/auth/guards';
import { getHomeState } from '@/lib/db/home';
import { getRoomSurfaces } from '@/lib/db/home-surfaces';
import { getSurface } from '@/lib/home/surfaces';
import { HomeRoomView } from '@/components/home/HomeRoomView';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const [{ ownedSlugs, placements }, roomSurfaces] = await Promise.all([
    getHomeState(child.id),
    getRoomSurfaces(child.id),
  ]);
  // Owned slugs include all kind='home' purchases; surfaces are the ones in the catalog.
  const ownedSurfaceSlugs = ownedSlugs.filter((s) => getSurface(s) !== undefined);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <h1 className="font-hanzi text-2xl font-bold tracking-tight text-[var(--color-ocean-900)]">
        🏠 我的家 / My Home
      </h1>

      {ownedSlugs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-sunset-400)] bg-white/70 p-8 text-center text-sm text-[var(--color-sand-900)]">
          <p className="text-4xl">🛋️</p>
          <p className="mt-3 font-semibold">家里还没有家具 / No furniture yet</p>
          <p className="mt-1 text-[var(--color-sand-700)]">
            去商店买家具吧 / Buy furniture in the shop
          </p>
          <Link
            href={`/play/${childId}/shop`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-ocean-700)] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[var(--color-ocean-800)]"
          >
            🛒 去商店 / To shop
          </Link>
        </div>
      ) : (
        <HomeRoomView
          childId={child.id}
          ownedSlugs={ownedSlugs}
          placements={placements}
          roomSurfaces={roomSurfaces}
          ownedSurfaceSlugs={ownedSurfaceSlugs}
        />
      )}
    </main>
  );
}
