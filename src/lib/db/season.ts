// NEVER import this file from client code. It pulls in postgres.
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  seasons,
  childSeasonProgress,
  xpEvents,
  collectionPacks,
  collectibleItems,
  childCollections,
  childShards,
  powerupInventory,
  avatarItems,
  childAvatarInventory,
  childAvatarEquipped,
  trophies,
  childTrophies,
} from '@/db/schema';
import { awardCoinsInTx } from '@/lib/db/coins';
import type { Tx } from '@/lib/db/grants';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { SeasonRow, SeasonTier, SeasonReward } from '@/lib/season/types';
import { assembleSeasonView, type SeasonView } from '@/lib/season/view';
import { claimableTiers } from '@/lib/season/levels';

export const SEASON_PACK_SLUG = 'season-summer-v1';

function mapSeason(row: typeof seasons.$inferSelect): SeasonRow {
  return {
    id: row.id,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    themeEmoji: row.themeEmoji,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    tierConfig: row.tierConfig as SeasonTier[],
    isActive: row.isActive,
  };
}

/** The single active season (is_active = true), or null. */
export async function getActiveSeason(): Promise<SeasonRow | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  return rows[0] ? mapSeason(rows[0]) : null;
}

/** Derived season XP: sum of xp_events.amount within [startsAt, endsAt]. */
export async function getSeasonXp(
  childId: string,
  season: Pick<SeasonRow, 'startsAt' | 'endsAt'>,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.childId, childId),
        gte(xpEvents.createdAt, season.startsAt),
        lte(xpEvents.createdAt, season.endsAt),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Per-child claimed-tier set (empty array when no row yet). */
export async function getSeasonProgress(
  childId: string,
  seasonId: string,
): Promise<number[]> {
  const rows = await db
    .select({ tiersClaimed: childSeasonProgress.tiersClaimed })
    .from(childSeasonProgress)
    .where(
      and(
        eq(childSeasonProgress.childId, childId),
        eq(childSeasonProgress.seasonId, seasonId),
      ),
    )
    .limit(1);
  return rows[0]?.tiersClaimed ?? [];
}

// ───────────────────────── reward dispatch ─────────────────────────

export interface SeasonClaimResult {
  claimed: boolean;
  reveal: RevealCard | null;
}

async function grantCardInTx(
  tx: Tx,
  childId: string,
  cardSlug: string,
): Promise<RevealCard> {
  const [item] = await tx
    .select({
      id: collectibleItems.id,
      slug: collectibleItems.slug,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh,
      loreEn: collectibleItems.loreEn,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(
      and(
        eq(collectionPacks.slug, SEASON_PACK_SLUG),
        eq(collectibleItems.slug, cardSlug),
      ),
    );
  if (!item) throw new Error(`season card not seeded: ${SEASON_PACK_SLUG}/${cardSlug}`);

  const owned = await tx
    .select({ count: childCollections.count })
    .from(childCollections)
    .where(
      and(
        eq(childCollections.childId, childId),
        eq(childCollections.itemId, item.id),
      ),
    );
  const isDupe = owned.length > 0;
  if (isDupe) {
    await tx
      .update(childCollections)
      .set({ count: sql`${childCollections.count} + 1` })
      .where(
        and(
          eq(childCollections.childId, childId),
          eq(childCollections.itemId, item.id),
        ),
      );
  } else {
    await tx.insert(childCollections).values({ childId, itemId: item.id, count: 1 });
  }
  return {
    id: item.id,
    slug: item.slug,
    packSlug: SEASON_PACK_SLUG,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    loreZh: item.loreZh,
    loreEn: item.loreEn,
    isDupe,
    shardsAfter: 0,
  };
}

async function grantCosmeticInTx(
  tx: Tx,
  childId: string,
  unlockRef: string,
  equip: boolean,
): Promise<void> {
  const [item] = await tx
    .select({ id: avatarItems.id, slotId: avatarItems.slotId })
    .from(avatarItems)
    .where(eq(avatarItems.unlockRef, unlockRef))
    .limit(1);
  if (!item) return; // best effort — not seeded yet
  await tx
    .insert(childAvatarInventory)
    .values({ childId, avatarItemId: item.id })
    .onConflictDoNothing();
  if (equip) {
    await tx
      .insert(childAvatarEquipped)
      .values({ childId, slotId: item.slotId, avatarItemId: item.id })
      .onConflictDoUpdate({
        target: [childAvatarEquipped.childId, childAvatarEquipped.slotId],
        set: { avatarItemId: item.id },
      });
  }
}

async function grantTrophyInTx(
  tx: Tx,
  childId: string,
  slug: string,
): Promise<void> {
  const [t] = await tx
    .select({ id: trophies.id })
    .from(trophies)
    .where(eq(trophies.slug, slug))
    .limit(1);
  if (!t) return; // best effort — not seeded yet
  await tx
    .insert(childTrophies)
    .values({ childId, trophyId: t.id })
    .onConflictDoNothing();
}

async function grantRewardInTx(
  tx: Tx,
  childId: string,
  seasonId: string,
  tier: number,
  reward: SeasonReward,
): Promise<RevealCard | null> {
  switch (reward.type) {
    case 'coins':
      await awardCoinsInTx(tx, {
        childId,
        delta: reward.amount,
        reason: 'season_reward',
        refType: 'season_tier',
        refId: `${seasonId}:${tier}`,
      });
      return null;
    case 'powerup':
      await tx
        .insert(powerupInventory)
        .values({ childId, kind: reward.kind, count: reward.count })
        .onConflictDoUpdate({
          target: [powerupInventory.childId, powerupInventory.kind],
          set: { count: sql`${powerupInventory.count} + ${reward.count}` },
        });
      return null;
    case 'shards':
      await tx
        .insert(childShards)
        .values({ childId, shards: reward.amount })
        .onConflictDoUpdate({
          target: childShards.childId,
          set: { shards: sql`${childShards.shards} + ${reward.amount}` },
        });
      return null;
    case 'card':
      return grantCardInTx(tx, childId, reward.cardSlug);
    case 'cosmetic':
      await grantCosmeticInTx(tx, childId, reward.unlockRef, false); // NOT equipped
      return null;
    case 'cosmetic_set':
      for (const ref of reward.unlockRefs) {
        await grantCosmeticInTx(tx, childId, ref, true); // grand set auto-equips
      }
      await grantTrophyInTx(tx, childId, reward.trophySlug);
      return null;
  }
}

/**
 * Claim one reached tier inside a transaction. Re-reads claim state inside the
 * tx (idempotent — a tier already in `tiers_claimed` is a no-op), grants the
 * reward, then appends the tier. Caller is responsible for verifying the tier is
 * actually reached by season XP (the action does this).
 */
export async function claimSeasonTierInTx(
  tx: Tx,
  childId: string,
  seasonId: string,
  tier: SeasonTier,
): Promise<SeasonClaimResult> {
  await tx
    .insert(childSeasonProgress)
    .values({ childId, seasonId, tiersClaimed: [] })
    .onConflictDoNothing();
  const [row] = await tx
    .select({ tiersClaimed: childSeasonProgress.tiersClaimed })
    .from(childSeasonProgress)
    .where(
      and(
        eq(childSeasonProgress.childId, childId),
        eq(childSeasonProgress.seasonId, seasonId),
      ),
    )
    .limit(1);
  const claimed = row?.tiersClaimed ?? [];
  if (claimed.includes(tier.tier)) return { claimed: false, reveal: null };

  const reveal = await grantRewardInTx(tx, childId, seasonId, tier.tier, tier.reward);

  await tx
    .update(childSeasonProgress)
    .set({
      tiersClaimed: sql`array_append(${childSeasonProgress.tiersClaimed}, ${tier.tier})`,
    })
    .where(
      and(
        eq(childSeasonProgress.childId, childId),
        eq(childSeasonProgress.seasonId, seasonId),
      ),
    );
  return { claimed: true, reveal };
}

// ───────────────────────── views + sync ─────────────────────────

/**
 * End-of-season auto-bank: if the season has ENDED, claim every reached-but-
 * unclaimed tier silently (nothing is lost). No-op during the active season.
 */
export async function syncSeasonProgress(childId: string): Promise<void> {
  const season = await getActiveSeason();
  if (!season) return;
  if (Date.now() <= season.endsAt.getTime()) return; // only sweep AFTER end
  const xp = await getSeasonXp(childId, season);
  const claimed = await getSeasonProgress(childId, season.id);
  const toClaim = claimableTiers(xp, claimed, season.tierConfig);
  if (toClaim.length === 0) return;
  await db.transaction(async (tx) => {
    for (const tierNum of toClaim) {
      const tier = season.tierConfig.find((t) => t.tier === tierNum)!;
      await claimSeasonTierInTx(tx, childId, season.id, tier);
    }
  });
}

/** Full season view for the season page. Returns null when no active season. */
export async function getSeasonView(childId: string): Promise<SeasonView | null> {
  const season = await getActiveSeason();
  if (!season) return null;
  const [xp, claimed] = await Promise.all([
    getSeasonXp(childId, season),
    getSeasonProgress(childId, season.id),
  ]);
  return assembleSeasonView(season, xp, claimed, Date.now());
}

/** Compact state for the home banner. */
export interface SeasonBannerState {
  nameZh: string;
  nameEn: string;
  themeEmoji: string;
  currentTier: number;
  totalTiers: number;
  xpToNext: number | null;
  claimableCount: number;
}

export async function getSeasonBannerState(
  childId: string,
): Promise<SeasonBannerState | null> {
  const view = await getSeasonView(childId);
  if (!view) return null;
  const claimableCount = view.tiers.filter((t) => t.state === 'claimable').length;
  return {
    nameZh: view.nameZh,
    nameEn: view.nameEn,
    themeEmoji: view.themeEmoji,
    currentTier: view.currentTier,
    totalTiers: view.tiers.length,
    xpToNext: view.xpToNext,
    claimableCount,
  };
}
