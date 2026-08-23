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
import {
  frontierWeekNumber,
  isWeekUnlockedFrom,
  listBossWeekIds,
  listChildPlayableWeeks,
} from '@/lib/db/weeks';
import { KeyTrack } from '@/components/play/KeyTrack';
import {
  MAP_TO_VAULT_CARD,
  VAULT_TREASURES_BY_SLUG,
} from '@/lib/collections/keyVaultData';
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
import {
  isMapFullyCleared,
  getFinalBossClear,
  listFinalBossClears,
} from '@/lib/db/final-boss';
import { latestChampionTitle } from '@/lib/collections/championsData';
import { mapOrderIndex } from '@/lib/play/map-order';
import { ChampionTitleChip } from '@/components/play/ChampionTitleChip';
import { TravelingMerchant } from '@/components/play/TravelingMerchant';
import { getMerchantOffer, hasBoughtMerchantToday } from '@/lib/db/merchant';
import { WantedPosters } from '@/components/play/WantedPosters';
import { generateDailyBounties, listTodayBounties } from '@/lib/db/bounties';
import { listUnseenGifts } from '@/lib/db/gifts';
import { GiftInbox } from '@/components/play/GiftInbox';

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
    merchantOffer,
    merchantBought,
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
    getMerchantOffer(child.id, todayIso),
    hasBoughtMerchantToday(child.id, todayIso),
  ]);

  const currentMap = maps.find((m) => m.isCurrent) ?? null;
  const voyage = currentMap ? getVoyageMap(currentMap.slug) : null;

  // Final-boss state for the CURRENT map (drives the voyage-board lair node) +
  // the latest champion title (highest map order among beaten maps with a title).
  const [finalBossState, beatenPackIds] = await Promise.all([
    currentMap
      ? Promise.all([
          isMapFullyCleared(child.id, currentMap.packId),
          getFinalBossClear(child.id, currentMap.packId),
        ]).then(([unlocked, cleared]) => ({ unlocked, cleared }))
      : Promise.resolve(null),
    listFinalBossClears(child.id),
  ]);

  const slugForPackId = (packId: string) =>
    maps.find((m) => m.packId === packId)?.slug;
  const championTitle = latestChampionTitle(
    beatenPackIds,
    slugForPackId,
    mapOrderIndex,
  );

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
  const bossClearedByWeek = new Map(
    progressRows.map((p) => [p.weekId, p.bossCleared]),
  );

  // T3 linear gating: everything past the frontier is 🔒. Derived here from the
  // same rule the server-side route guards enforce (isWeekUnlockedFrom), so the
  // board can never advertise an island the hub would bounce her out of.
  // `hasBoss` matters: a bossless week can never be cleared, so leaving it in
  // the candidate set would pin the frontier there and lock the rest forever.
  const bossWeekIds = await listBossWeekIds(playableWeeks.map((w) => w.id));
  const frontierNumber = frontierWeekNumber(
    playableWeeks.map((w) => ({
      id: w.id,
      weekNumber: w.weekNumber,
      hasBoss: bossWeekIds.has(w.id),
    })),
    new Set(progressRows.filter((p) => p.bossCleared).map((p) => p.weekId)),
  );

  const islands = playableWeeks.map((w) => ({
    weekId: w.id,
    weekNumber: w.weekNumber,
    label: w.label,
    completionPercent: progressByWeek.get(w.id) ?? 0,
    // T1: 🏴 on the board means the BOSS is beaten (not just a section done).
    bossCleared: bossClearedByWeek.get(w.id) ?? false,
    locked: !isWeekUnlockedFrom(
      w.weekNumber,
      frontierNumber,
      bossClearedByWeek.get(w.id) ?? false,
    ),
  }));

  const clearedCount = islands.filter((i) => i.bossCleared).length;

  // T3 🗝️ key ring — one key per beaten boss on the CURRENT map (scoped to the
  // pack, mirroring getWeekGateState / isMapFullyCleared). Fully derived: a key
  // is never stored, so it can't drift from the week progress it represents.
  // Only BOSSED weeks mint a key — otherwise the ring could never fill and the
  // vault would advertise a prize the child has no way to reach.
  const mapWeeks = currentMap
    ? playableWeeks.filter(
        (w) => w.curriculumPackId === currentMap.packId && bossWeekIds.has(w.id),
      )
    : [];
  const vaultSlug = currentMap ? MAP_TO_VAULT_CARD[currentMap.slug] : undefined;
  const vaultTreasure = vaultSlug ? VAULT_TREASURES_BY_SLUG[vaultSlug] : undefined;
  const keys = {
    earned: mapWeeks.filter((w) => bossClearedByWeek.get(w.id)).length,
    total: mapWeeks.length,
    prizeZh: vaultTreasure?.nameZh ?? '神秘宝藏',
    prizeEn: vaultTreasure?.nameEn ?? 'a mystery treasure',
  };

  // Derive bossUnlocked: true if the child has ever cleared a boss (proxy for
  // "boss is currently reachable in their play history"). Defaults to false when
  // no progress rows exist — worst case the boss_clear quest won't be assigned.
  const bossUnlocked = progressRows.some((p) => p.bossCleared);
  // T1: the 新岛先锋 frontier quest is only assignable while a frontier exists.
  // (Not "some week is uncleared" — a bossless week is uncleared forever, which
  // would keep handing out a quest that pays no double treasure.)
  const hasFrontier = frontierNumber !== null;
  const questCtx = { bossUnlocked, hasFrontier };

  // Generate today's quests + bounty posters (both idempotent on render).
  await Promise.all([
    generateDailyQuests(child.id, questCtx),
    generateDailyBounties(child.id, todayIso),
  ]);
  const [todayQuests, chestClaimed, bounties, unseenGifts] = await Promise.all([
    getTodayQuests(child.id),
    getDailyChestClaimed(child.id),
    listTodayBounties(child.id, todayIso),
    // Gifts already transferred when they were sent; this is the unopened
    // queue. Picked up on the home render — the same place quests and bounties
    // are — because the giver's revalidatePath only refreshes the GIVER.
    listUnseenGifts(child.id),
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
          {/* A4 juice: gentle idle bob — home HUD only, CSS-only, reduced-motion safe */}
          <div className="animate-avatar-idle shrink-0">
            <AvatarRender
              equipped={equippedRefs}
              size={64}
              label={`${child.displayName} 的形象 / ${child.displayName}'s avatar`}
              className="shrink-0"
            />
          </div>
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
            <div className="flex flex-wrap items-center gap-1.5">
              <LevelBadge level={level} title={levelTitle} />
              <ChampionTitleChip
                titleZh={championTitle?.zh ?? null}
                titleEn={championTitle?.en ?? null}
              />
            </div>
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

      <KeyTrack
        earned={keys.earned}
        total={keys.total}
        prizeZh={keys.prizeZh}
        prizeEn={keys.prizeEn}
        opened={keys.total > 0 && keys.earned >= keys.total}
      />

      <WantedPosters childId={childId} posters={bounties} />

      <TravelingMerchant
        childId={childId}
        offer={merchantOffer}
        boughtToday={merchantBought}
        balance={balance.balance}
      />

      <SeasonBanner childId={childId} state={seasonBanner} />

      {/* Unopened gifts from crewmates. Rendered here so the chest is the
          first thing the child meets on arriving home. */}
      <GiftInbox childId={childId} gifts={unseenGifts} />
      </div>

      {/* Map pane — right on lg, below the HUD on phones */}
      <div className="flex flex-col">
      {islands.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-sunset-400)] bg-white/70 p-8 text-center text-sm text-[var(--color-sand-900)]">
          <p className="font-semibold">
            还没有岛屿哦，船长！ / No islands yet, captain.
          </p>
          <p className="mt-1 text-[var(--color-sand-700)]">
            家长需要先发布一周的内容，请前往{' '}
            <Link
              href="/parent"
              className="font-semibold text-[var(--color-ocean-700)] underline"
            >
              家长面板 / parent dashboard
            </Link>
            。 / A parent needs to publish a week first — visit the parent
            dashboard.
          </p>
        </div>
      ) : voyage ? (
        <VoyageBoard
          childId={childId}
          packSlug={currentMap!.slug}
          islands={islands.map((i) => ({
            weekId: i.weekId,
            completionPercent: i.completionPercent,
            bossCleared: i.bossCleared,
            locked: i.locked,
          }))}
          finalBoss={finalBossState ?? undefined}
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
