import Link from 'next/link';
import { IslandMap } from '@/components/play/IslandMap';
import { VoyageBoard } from '@/components/play/VoyageBoard';
import { getVoyageMap } from '@/lib/play/map-boards';
import { AvatarRender } from '@/components/play/AvatarRender';
import { WeekStrip } from '@/components/play/WeekStrip';
import { LevelBadge } from '@/components/play/LevelBadge';
import { DailyQuestsPanel } from '@/components/play/DailyQuestsPanel';
import { SeasonBanner } from '@/components/play/SeasonBanner';
import { getSeasonBannerState, syncSeasonProgress } from '@/lib/db/season';
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
import { generateDailyQuests, getTodayQuests, getDailyChestClaimed } from '@/lib/db/quests';
import { getChildXp } from '@/lib/db/xp';
import { titleForLevel } from '@/lib/xp/levels';
import { getQuestDef } from '@/lib/quests/definitions';

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

  // End-of-season auto-bank (no-op during the active season): banks any
  // reached-but-unclaimed tiers once the season has ended so nothing is lost.
  await syncSeasonProgress(child.id);

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
    xpData,
    seasonBanner,
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
    getChildXp(child.id),
    getSeasonBannerState(child.id),
  ]);

  const currentMap = maps.find((m) => m.isCurrent) ?? null;
  const voyage = currentMap ? getVoyageMap(currentMap.slug) : null;

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

  // Derive bossUnlocked: true if the child has ever cleared a boss (proxy for
  // "boss is currently reachable in their play history"). Defaults to false when
  // no progress rows exist — worst case the boss_clear quest won't be assigned.
  const bossUnlocked = progressRows.some((p) => p.bossCleared);
  const questCtx = { bossUnlocked };

  // Generate today's quests (idempotent: no-ops when rows exist for today).
  await generateDailyQuests(child.id, questCtx);
  const [todayQuests, chestClaimed] = await Promise.all([
    getTodayQuests(child.id),
    getDailyChestClaimed(child.id),
  ]);

  const allDone =
    todayQuests.length >= 3 && todayQuests.every((q) => q.completed);

  // Map DB rows → card props (def carries emoji/labelZh; fall back to row fields)
  const questCardProps = todayQuests.map((q) => {
    const def = getQuestDef(q.questId);
    return {
      emoji: def?.emoji ?? '🧭',
      labelZh: def?.labelZh ?? q.questId,
      progress: q.progress,
      target: q.target,
      completed: q.completed,
    };
  });

  // Level badge
  const { level } = xpData;
  const levelTitle = titleForLevel(level);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6 lg:grid lg:max-w-none lg:grid-cols-[minmax(300px,360px)_1fr] lg:items-start lg:gap-6">
      {/* HUD column — left on lg, top of the stack on phones */}
      <div className="flex flex-col gap-5">
      <section className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarRender
            equipped={equippedRefs}
            size={64}
            label={`${child.displayName} 的形象 / ${child.displayName}'s avatar`}
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
              {child.displayName} 的航海图 / chart
            </h1>
            <p className="text-sm text-[var(--color-sand-700)]">
              {clearedCount}/{islands.length} island
              {islands.length === 1 ? '' : 's'} cleared
            </p>
            <LevelBadge level={level} title={levelTitle} />
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
            ? {
                slug: currentMap.slug,
                nameZh: currentMap.nameZh,
                nameEn: currentMap.nameEn,
              }
            : null
        }
      />

      <WeekStrip activity={weekActivity} todayIso={todayIso} childId={childId} checkInDays={countCheckInDays(weekActivity)} />

      {questCardProps.length > 0 && (
        <DailyQuestsPanel
          childId={child.id}
          quests={questCardProps}
          allDone={allDone}
          initialChestClaimed={chestClaimed}
        />
      )}

      <SeasonBanner childId={childId} state={seasonBanner} />
      </div>

      {/* Map pane — right on lg, below the HUD on phones */}
      <div className="flex flex-col">
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
      ) : voyage ? (
        <VoyageBoard
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
      </div>
    </main>
  );
}
