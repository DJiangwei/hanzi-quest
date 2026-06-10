import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  collectionPacks,
  collectibleItems,
  childCollections,
  festivalChallengeClaims,
} from '@/db/schema';
import { getActivityForRange } from './activity';
import {
  festivalThemeForMonth,
  type FestivalTheme,
} from '@/lib/calendar/festivals';
import type { RevealCard } from '@/lib/play/reveal-card';

export const FESTIVALS_PACK_SLUG = 'festivals-v1';

export interface MonthlyChallengeState {
  theme: FestivalTheme;
  activeDays: number;
  threshold: number;
  claimed: boolean;
  eligible: boolean;
}

export type FestivalClaimResult =
  | { granted: true; card: RevealCard }
  | { granted: false; reason: 'not_eligible' | 'already_claimed' };

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
    };
  });
}
