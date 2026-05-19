import Link from 'next/link';
import { IslandMap } from '@/components/play/IslandMap';
import { AvatarRender } from '@/components/play/AvatarRender';
import { requireChild } from '@/lib/auth/guards';
import { getCoinBalance } from '@/lib/db/coins';
import { getPackBySlug, listChildCollection } from '@/lib/db/collections';
import { listProgressByChild } from '@/lib/db/play';
import { getEquippedAvatar } from '@/lib/db/shop';
import { listChildPlayableWeeks } from '@/lib/db/weeks';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function PlayHomePage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const [playableWeeks, progressRows, balance, pack, equipped] =
    await Promise.all([
      listChildPlayableWeeks(child.id),
      listProgressByChild(child.id),
      getCoinBalance(child.id),
      getPackBySlug('zodiac-v1'),
      getEquippedAvatar(child.id),
    ]);

  const equippedRefs: Partial<Record<string, string | null>> = {};
  for (const [slot, info] of Object.entries(equipped)) {
    equippedRefs[slot] = info.unlockRef;
  }

  const ownedCount = pack
    ? (await listChildCollection(child.id, pack.id)).length
    : 0;

  const progressByWeek = new Map(
    progressRows.map((p) => [p.weekId, p.completionPercent]),
  );

  const islands = playableWeeks.map((w) => ({
    weekId: w.id,
    weekNumber: w.weekNumber,
    label: w.label,
    completionPercent: progressByWeek.get(w.id) ?? 0,
  }));

  const clearedCount = islands.filter((i) => i.completionPercent >= 100).length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <section className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarRender
            equipped={equippedRefs}
            size={64}
            label={`${child.displayName} 的形象`}
            className="shrink-0"
          />
          <div>
            <h1 className="font-hanzi text-2xl font-bold tracking-tight text-[var(--color-ocean-900)]">
              {child.displayName} 的航海图
            </h1>
            <p className="text-sm text-[var(--color-sand-700)]">
              {clearedCount}/{islands.length} island
              {islands.length === 1 ? '' : 's'} cleared
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-treasure-400)] px-3 py-1.5 text-base font-bold text-[var(--color-treasure-700)] shadow-md">
          <span className="text-xl">🪙</span>
          {balance.balance}
        </span>
      </section>

      {islands.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-sunset-400)] bg-white/70 p-8 text-center text-sm text-[var(--color-sand-900)]">
          <p className="font-semibold">No islands yet, captain.</p>
          <p className="mt-1 text-[var(--color-sand-700)]">
            A parent needs to publish a week first. Visit{' '}
            <Link
              href="/parent/stage/new"
              className="font-semibold text-[var(--color-ocean-700)] underline"
            >
              parent dashboard
            </Link>
            .
          </p>
        </div>
      ) : (
        <IslandMap childId={childId} islands={islands} ownedCount={ownedCount} />
      )}
    </main>
  );
}
