import Link from 'next/link';
import { IslandMap } from '@/components/play/IslandMap';
import { MapBoard } from '@/components/play/MapBoard';
import { getMapBoard } from '@/lib/play/map-boards';
import { AvatarRender } from '@/components/play/AvatarRender';
import { LatestChapterPill } from '@/components/play/LatestChapterPill';
import { WeekStrip } from '@/components/play/WeekStrip';
import { requireChild } from '@/lib/auth/guards';
import { getCoinBalance } from '@/lib/db/coins';
import {
  listActivePacks,
  listChildCollection,
  listPackItems,
} from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { listProgressByChild } from '@/lib/db/play';
import { getEquippedAvatar } from '@/lib/db/shop';
import { listChildPlayableWeeks } from '@/lib/db/weeks';
import { PetCompanion } from '@/components/play/PetCompanion';
import { getEquippedPet } from '@/lib/db/pets';
import { listOwnedDecorationsForChild } from '@/lib/db/decor';
import { getActivityForRange } from '@/lib/db/activity';
import { todayUtcIso } from '@/lib/db/streaks';
import { MapHeaderPill } from '@/components/play/MapHeaderPill';
import { listMapsForChild } from '@/lib/db/maps';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';
import { countCheckInDays } from '@/lib/db/checkins';

function isoDateAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function PlayHomePage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const todayIso = todayUtcIso();
  const monday = mondayOfIsoWeek(todayIso);
  const sunday = isoDateAddDays(monday, 6);

  const [
    playableWeeks,
    progressRows,
    balance,
    activePacks,
    equipped,
    pet,
    ownedDecorations,
    weekActivity,
    maps,
  ] = await Promise.all([
    listChildPlayableWeeks(child.id),
    listProgressByChild(child.id),
    getCoinBalance(child.id),
    listActivePacks(),
    getEquippedAvatar(child.id),
    getEquippedPet(child.id),
    listOwnedDecorationsForChild(child.id),
    getActivityForRange(child.id, monday, sunday),
    listMapsForChild(child.id),
  ]);

  const currentMap = maps.find((m) => m.isCurrent) ?? null;
  const mapBoard = currentMap ? getMapBoard(currentMap.slug) : null;

  const equippedRefs: Partial<Record<string, string | null>> = {};
  for (const [slot, info] of Object.entries(equipped)) {
    equippedRefs[slot] = info.unlockRef;
  }

  const packStats = await Promise.all(
    activePacks
      .filter((p) => getPackMeta(p.slug) !== null)
      .map(async (p) => {
        const [items, owned] = await Promise.all([
          listPackItems(p.id),
          listChildCollection(child.id, p.id),
        ]);
        return { total: items.length, owned: owned.length };
      }),
  );
  const ownedCount = packStats.reduce((s, p) => s + p.owned, 0);
  const totalCount = packStats.reduce((s, p) => s + p.total, 0);

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
          <PetCompanion
            pet={
              pet
                ? {
                    emoji: pet.emoji,
                    nameZh: pet.nameZh,
                    nameEn: pet.nameEn,
                    speechZh: pet.speechZh,
                    speechEn: pet.speechEn,
                  }
                : null
            }
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

      <MapHeaderPill
        childId={childId}
        currentMap={
          currentMap
            ? { nameZh: currentMap.nameZh, nameEn: currentMap.nameEn }
            : null
        }
      />

      <WeekStrip activity={weekActivity} todayIso={todayIso} childId={childId} checkInDays={countCheckInDays(weekActivity)} />

      <LatestChapterPill childId={child.id} />

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
      ) : mapBoard ? (
        <MapBoard
          childId={childId}
          packSlug={currentMap!.slug}
          islands={islands.map((i) => ({ weekId: i.weekId, completionPercent: i.completionPercent }))}
        />
      ) : (
        <IslandMap
          childId={childId}
          islands={islands}
          ownedCount={ownedCount}
          totalCount={totalCount}
          decorations={ownedDecorations.map((d) => ({ slug: d.slug }))}
        />
      )}
    </main>
  );
}
