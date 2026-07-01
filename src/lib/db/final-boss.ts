// NEVER import this file from client code — it pulls in postgres.
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  finalBossClears,
  collectibleItems,
  collectionPacks,
  avatarItems,
  childAvatarInventory,
  childAvatarEquipped,
} from '@/db/schema';
import { listChildPlayableWeeks } from '@/lib/db/weeks';
import { listProgressByChild } from '@/lib/db/play';
import { grantSpecificCardInTx } from '@/lib/db/admin-grants';
import {
  checkAndGrantTrophies,
  type GrantedTrophy,
} from '@/lib/db/trophies';
import { MAP_TO_CHAMPION_CARD } from '@/lib/collections/championsData';
import type { RevealCard } from '@/lib/play/reveal-card';

const CHAMPIONS_PACK_SLUG = 'champions-v1';

interface WeekLite {
  id: string;
  curriculumPackId: string;
}
interface ProgressLite {
  weekId: string;
  bossCleared: boolean;
}

/** Pure core: true iff the pack has ≥1 week and every one is bossCleared. */
export function isMapFullyClearedFrom(
  packId: string,
  weeks: WeekLite[],
  progress: ProgressLite[],
): boolean {
  const packWeeks = weeks.filter((w) => w.curriculumPackId === packId);
  if (packWeeks.length === 0) return false;
  const clearedSet = new Set(
    progress.filter((p) => p.bossCleared).map((p) => p.weekId),
  );
  return packWeeks.every((w) => clearedSet.has(w.id));
}

export async function isMapFullyCleared(
  childId: string,
  packId: string,
): Promise<boolean> {
  const [weeks, progress] = await Promise.all([
    listChildPlayableWeeks(childId),
    listProgressByChild(childId),
  ]);
  return isMapFullyClearedFrom(
    packId,
    weeks as WeekLite[],
    progress as ProgressLite[],
  );
}

/** Whether this child has beaten this map's final boss. */
export async function getFinalBossClear(
  childId: string,
  packId: string,
): Promise<boolean> {
  const rows = await db
    .select({ packId: finalBossClears.packId })
    .from(finalBossClears)
    .where(
      and(
        eq(finalBossClears.childId, childId),
        eq(finalBossClears.packId, packId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** All pack ids this child has beaten the final boss for (for gating). */
export async function listFinalBossClears(childId: string): Promise<string[]> {
  const rows = await db
    .select({ packId: finalBossClears.packId })
    .from(finalBossClears)
    .where(eq(finalBossClears.childId, childId));
  return rows.map((r) => r.packId);
}

/**
 * Insert the (child, pack) clear. `firstClear=false` if it already existed —
 * this row is the single idempotency guard for the champion reward grant.
 */
export async function recordFinalBossClear(
  childId: string,
  packId: string,
): Promise<{ firstClear: boolean }> {
  try {
    await db.insert(finalBossClears).values({ childId, packId });
    return { firstClear: true };
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return { firstClear: false };
    }
    throw err;
  }
}

/**
 * Grant + auto-equip the reward-only champion crown cosmetic. Best effort: if
 * the crown item isn't seeded yet, no-ops (the card/trophy grant must not depend
 * on it). Idempotent — inventory insert ignores a re-grant; equip upserts the
 * slot. Mirrors `grantContinentCosmetic`. The crown's `unlockRef` is the SAME
 * string as the champion card slug (Task 5), so `unlockRef === cardSlug`.
 */
async function grantChampionCosmetic(
  childId: string,
  unlockRef: string,
): Promise<void> {
  const rows = await db
    .select({ id: avatarItems.id, slotId: avatarItems.slotId })
    .from(avatarItems)
    .where(eq(avatarItems.unlockRef, unlockRef))
    .limit(1);
  const item = rows[0];
  if (!item) return; // cosmetic not seeded yet — best effort

  await db
    .insert(childAvatarInventory)
    .values({ childId, avatarItemId: item.id })
    .onConflictDoNothing();

  await db
    .insert(childAvatarEquipped)
    .values({ childId, slotId: item.slotId, avatarItemId: item.id })
    .onConflictDoUpdate({
      target: [childAvatarEquipped.childId, childAvatarEquipped.slotId],
      set: { avatarItemId: item.id },
    });
}

export interface MapChampionRewards {
  card: RevealCard | null;
  trophies: GrantedTrophy[];
}

/**
 * Grant the full champion bundle for beating `packSlug`'s final boss:
 *  - the specific reward-only champion CARD (grantSpecificCardInTx),
 *  - the champion TROPHY (checkAndGrantTrophies 'map-champion'),
 *  - the champion CROWN cosmetic, auto-equipped (best effort).
 * The CALLER owns idempotency (final_boss_clears insert) — this just grants.
 */
export async function grantMapChampionRewards(
  childId: string,
  packSlug: string,
): Promise<MapChampionRewards> {
  let card: RevealCard | null = null;
  const cardSlug = MAP_TO_CHAMPION_CARD[packSlug];

  if (cardSlug) {
    const itemRows = await db
      .select({
        id: collectibleItems.id,
        slug: collectibleItems.slug,
        nameZh: collectibleItems.nameZh,
        nameEn: collectibleItems.nameEn,
        loreZh: collectibleItems.loreZh,
        loreEn: collectibleItems.loreEn,
      })
      .from(collectibleItems)
      .innerJoin(
        collectionPacks,
        eq(collectionPacks.id, collectibleItems.packId),
      )
      .where(
        and(
          eq(collectionPacks.slug, CHAMPIONS_PACK_SLUG),
          eq(collectibleItems.slug, cardSlug),
        ),
      )
      .limit(1);
    const item = itemRows[0];
    if (item) {
      await db.transaction((tx) => grantSpecificCardInTx(tx, childId, item.id));
      card = {
        id: item.id,
        slug: item.slug,
        packSlug: CHAMPIONS_PACK_SLUG,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        loreZh: item.loreZh,
        loreEn: item.loreEn,
        isDupe: false,
        shardsAfter: 0,
      };
    }
  }

  const trophies = await checkAndGrantTrophies(childId, {
    kind: 'map-champion',
    packSlug,
  });

  try {
    await grantChampionCosmetic(childId, cardSlug ?? '');
  } catch (err) {
    console.error('[final-boss] cosmetic grant failed:', err);
  }

  return { card, trophies };
}
