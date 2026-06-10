import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  collectionPacks,
  collectibleItems,
  childCollections,
  festivalChallengeClaims,
  avatarItems,
  childAvatarInventory,
  childAvatarEquipped,
} from '@/db/schema';
import { getActivityForRange } from './activity';
import {
  festivalThemeForMonth,
  type FestivalTheme,
} from '@/lib/calendar/festivals';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { Tx } from './grants';

export const FESTIVALS_PACK_SLUG = 'festivals-v1';

export interface MonthlyChallengeState {
  theme: FestivalTheme;
  activeDays: number;
  threshold: number;
  claimed: boolean;
  eligible: boolean;
}

/** The festival avatar cosmetic granted + auto-equipped on claim. */
export interface FestivalCosmetic {
  unlockRef: string;
  slotId: string;
}

export type FestivalClaimResult =
  | { granted: true; card: RevealCard; cosmetic: FestivalCosmetic | null }
  | { granted: false; reason: 'not_eligible' | 'already_claimed' };

/**
 * Grant + auto-equip the festival avatar cosmetic for `avatarItemRef`. Best
 * effort: if the avatar item isn't seeded yet, returns null (the card grant must
 * not fail because a cosmetic is missing). Idempotent — inventory insert ignores
 * a re-grant; equip upserts the slot.
 */
async function grantFestivalCosmeticInTx(
  tx: Tx,
  childId: string,
  avatarItemRef: string,
): Promise<FestivalCosmetic | null> {
  const rows = await tx
    .select({ id: avatarItems.id, slotId: avatarItems.slotId })
    .from(avatarItems)
    .where(eq(avatarItems.unlockRef, avatarItemRef))
    .limit(1);
  const item = rows[0];
  if (!item) return null;

  await tx
    .insert(childAvatarInventory)
    .values({ childId, avatarItemId: item.id })
    .onConflictDoNothing();

  await tx
    .insert(childAvatarEquipped)
    .values({ childId, slotId: item.slotId, avatarItemId: item.id })
    .onConflictDoUpdate({
      target: [childAvatarEquipped.childId, childAvatarEquipped.slotId],
      set: { avatarItemId: item.id },
    });

  return { unlockRef: avatarItemRef, slotId: item.slotId };
}

function monthRange(yyyymm: string): { startIso: string; endIso: string } {
  const [y, m] = yyyymm.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    startIso: `${yyyymm}-01`,
    endIso: `${yyyymm}-${String(lastDay).padStart(2, '0')}`,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

/**
 * Read-only state of this month's festival challenge for a child: the festival
 * theme, how many days they've played this month, the threshold, and whether the
 * reward is already claimed / currently claimable.
 */
export async function getMonthlyChallengeState(
  childId: string,
  yyyymm: string,
): Promise<MonthlyChallengeState> {
  const theme = festivalThemeForMonth(yyyymm);
  const { startIso, endIso } = monthRange(yyyymm);
  const [activity, claimRows] = await Promise.all([
    getActivityForRange(childId, startIso, endIso),
    db
      .select({ monthKey: festivalChallengeClaims.monthKey })
      .from(festivalChallengeClaims)
      .where(
        and(
          eq(festivalChallengeClaims.childId, childId),
          eq(festivalChallengeClaims.monthKey, yyyymm),
        ),
      ),
  ]);
  const activeDays = activity.filter((d) => d.played).length;
  const claimed = claimRows.length > 0;
  const eligible = activeDays >= theme.thresholdDays && !claimed;
  return { theme, activeDays, threshold: theme.thresholdDays, claimed, eligible };
}

/**
 * Claim the month's festival reward. Idempotent per (child, month) via the
 * `festival_challenge_claims` PK; re-checks the active-days threshold inside the
 * transaction. Grants the theme's festival card into the child's collection
 * (dupe → ×N bump) and returns it for the reveal.
 */
export async function claimFestivalReward(
  childId: string,
  yyyymm: string,
): Promise<FestivalClaimResult> {
  const theme = festivalThemeForMonth(yyyymm);
  const { startIso, endIso } = monthRange(yyyymm);

  // Threshold re-check (outside the tx read is fine — the PK insert is the real
  // idempotency guard).
  const activity = await getActivityForRange(childId, startIso, endIso);
  const activeDays = activity.filter((d) => d.played).length;
  if (activeDays < theme.thresholdDays) {
    return { granted: false, reason: 'not_eligible' };
  }

  return db.transaction(async (tx) => {
    // 1. Idempotency — once per (child, month).
    try {
      await tx.insert(festivalChallengeClaims).values({
        childId,
        monthKey: yyyymm,
        cardSlug: theme.cardSlug,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { granted: false, reason: 'already_claimed' };
      }
      throw err;
    }

    // 2. Resolve the festival card item.
    const itemRows = await tx
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
          eq(collectionPacks.slug, FESTIVALS_PACK_SLUG),
          eq(collectibleItems.slug, theme.cardSlug),
        ),
      );
    const item = itemRows[0];
    if (!item) {
      throw new Error(
        `festival card not seeded: ${FESTIVALS_PACK_SLUG}/${theme.cardSlug}`,
      );
    }

    // 3. Grant into the collection (dupe → ×N bump).
    const ownedRows = await tx
      .select({ count: childCollections.count })
      .from(childCollections)
      .where(
        and(
          eq(childCollections.childId, childId),
          eq(childCollections.itemId, item.id),
        ),
      );
    const isDupe = ownedRows.length > 0;
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
      await tx
        .insert(childCollections)
        .values({ childId, itemId: item.id, count: 1 });
    }

    // 4. Grant + auto-equip the festival avatar cosmetic (best effort).
    const cosmetic = await grantFestivalCosmeticInTx(
      tx,
      childId,
      theme.avatarItemRef,
    );

    return {
      granted: true,
      card: {
        id: item.id,
        slug: item.slug,
        packSlug: FESTIVALS_PACK_SLUG,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        loreZh: item.loreZh,
        loreEn: item.loreEn,
        isDupe,
        shardsAfter: 0,
      },
      cosmetic,
    };
  });
}
