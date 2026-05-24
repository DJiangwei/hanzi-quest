import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { childTrophies, trophies } from '@/db/schema';
import {
  countCompletedLevels,
  countDistinctBossWeeks,
  countOwnedDecorations,
  getLifetimeEarned,
  getLongestStreak,
  isPackComplete,
  isPerfectWeekForChild,
} from './trophies-evaluators';
import { getPackBySlug } from './collections';

export type TrophyRow = typeof trophies.$inferSelect;

export interface GrantedTrophy {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
}

export type TrophyCheckContext =
  | { kind: 'boss-clear'; weekId: string }
  | { kind: 'perfect-week'; weekId: string }
  | { kind: 'level-complete' }
  | { kind: 'coin-award' }
  | { kind: 'pack-complete'; packSlug: string }
  | { kind: 'scene-clear'; sceneType: string; score: number }
  | { kind: 'sound-theme-equip'; slug: string | null }
  | { kind: 'decor-purchase' };

export async function listAllTrophies(): Promise<TrophyRow[]> {
  return db
    .select()
    .from(trophies)
    .orderBy(trophies.category, trophies.displayOrder);
}

export async function listEarnedTrophies(
  childId: string,
): Promise<Array<{ trophyId: string; slug: string; earnedAt: Date }>> {
  return db
    .select({
      trophyId: childTrophies.trophyId,
      slug: trophies.slug,
      earnedAt: childTrophies.earnedAt,
    })
    .from(childTrophies)
    .innerJoin(trophies, eq(trophies.id, childTrophies.trophyId))
    .where(eq(childTrophies.childId, childId));
}

/** Map from pack slug → trophy slug */
const PACK_TO_TROPHY: Record<string, string> = {
  'zodiac-v1': 'collect-zodiac',
  'flags-v1': 'collect-flags',
  'sea-creatures-v1': 'collect-sea',
  'dinosaurs-v1': 'collect-dinos',
  'solar-system-v1': 'collect-solar',
};

/** Map from scene type → first-perfect-score trophy slug */
const SCENE_FIRST_TROPHY: Record<string, string> = {
  pinyin_pick: 'first-pinyin-pick',
  translate_pick: 'first-translate-pick',
  sentence_cloze: 'first-sentence-cloze',
};

/**
 * Evaluate which trophies should be granted for `childId` given `context`,
 * insert newly-earned rows (ON CONFLICT DO NOTHING for idempotency), and
 * return only the trophies newly granted in this call.
 */
export async function checkAndGrantTrophies(
  childId: string,
  context: TrophyCheckContext,
): Promise<GrantedTrophy[]> {
  const slugs = new Set<string>();

  switch (context.kind) {
    case 'boss-clear': {
      slugs.add('first-boss');
      const weeks = await countDistinctBossWeeks(childId);
      if (weeks >= 3) slugs.add('boss-trio');
      break;
    }
    case 'perfect-week': {
      const ok = await isPerfectWeekForChild(childId, context.weekId);
      if (ok) slugs.add('perfect-week');
      break;
    }
    case 'level-complete': {
      const completed = await countCompletedLevels(childId);
      if (completed >= 100) slugs.add('100-levels');
      if (completed >= 500) slugs.add('500-levels');
      const longest = await getLongestStreak(childId);
      if (longest >= 7) slugs.add('streak-7');
      if (longest >= 14) slugs.add('streak-14');
      if (longest >= 30) slugs.add('streak-30');
      break;
    }
    case 'coin-award': {
      const lifetime = await getLifetimeEarned(childId);
      if (lifetime >= 100) slugs.add('coins-100');
      if (lifetime >= 1000) slugs.add('coins-1k');
      if (lifetime >= 5000) slugs.add('coins-5k');
      break;
    }
    case 'pack-complete': {
      const trophySlug = PACK_TO_TROPHY[context.packSlug];
      if (!trophySlug) break;
      const pack = await getPackBySlug(context.packSlug);
      if (!pack) break;
      if (await isPackComplete(childId, pack.id)) slugs.add(trophySlug);
      break;
    }
    case 'scene-clear': {
      if (context.score < 100) break;
      const trophySlug = SCENE_FIRST_TROPHY[context.sceneType];
      if (trophySlug) slugs.add(trophySlug);
      break;
    }
    case 'sound-theme-equip': {
      if (context.slug && context.slug !== 'default') {
        slugs.add('equip-sound-theme');
      }
      break;
    }
    case 'decor-purchase': {
      const owned = await countOwnedDecorations(childId);
      if (owned >= 1) slugs.add('decor-starter');
      if (owned >= 10) slugs.add('decor-completionist');
      break;
    }
  }

  if (slugs.size === 0) return [];

  // ONE SQL pass: resolve slugs → trophy rows
  const trophyRows = await db
    .select()
    .from(trophies)
    .where(inArray(trophies.slug, Array.from(slugs)));

  if (trophyRows.length === 0) return [];

  // Filter out already-earned trophies for this child
  const alreadyEarned = await db
    .select({ trophyId: childTrophies.trophyId })
    .from(childTrophies)
    .where(
      and(
        eq(childTrophies.childId, childId),
        inArray(
          childTrophies.trophyId,
          trophyRows.map((t) => t.id),
        ),
      ),
    );
  const earnedSet = new Set(alreadyEarned.map((r) => r.trophyId));
  const toGrant = trophyRows.filter((t) => !earnedSet.has(t.id));
  if (toGrant.length === 0) return [];

  // Insert new earnings — ON CONFLICT DO NOTHING for concurrent-grant safety
  await db
    .insert(childTrophies)
    .values(toGrant.map((t) => ({ childId, trophyId: t.id })))
    .onConflictDoNothing();

  return toGrant.map((t) => ({
    slug: t.slug,
    nameZh: t.nameZh,
    nameEn: t.nameEn,
    emoji: t.emoji,
  }));
}
