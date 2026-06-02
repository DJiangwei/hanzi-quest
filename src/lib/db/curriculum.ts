import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles, curriculumPacks, weeks } from '@/db/schema';

export const SCHOOL_CUSTOM_SLUG = 'school-custom';

/**
 * Slug of the default shared curriculum pack. Every new child profile is
 * auto-enrolled in this pack so they get playable content immediately without
 * any parent authoring. The pack must be a shared (ownerUserId IS NULL) row
 * seeded by `scripts/seed-pirate-class.ts`.
 */
export const DEFAULT_SHARED_PACK_SLUG = 'pirate-class-level-1';

/**
 * Returns the id of the default shared curriculum pack (Caribbean Sea / Map 1).
 * Returns null if the pack doesn't exist in this env — callers should treat
 * that as "no enrollment, child has no playable content yet" rather than fail.
 */
export async function getDefaultSharedPackId(): Promise<string | null> {
  const [row] = await db
    .select({ id: curriculumPacks.id })
    .from(curriculumPacks)
    .where(
      and(
        eq(curriculumPacks.slug, DEFAULT_SHARED_PACK_SLUG),
        isNull(curriculumPacks.ownerUserId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export type CurriculumPackRow = typeof curriculumPacks.$inferSelect;

/**
 * Idempotently creates the per-family `school-custom` pack and returns its id.
 * Safe to call from the Clerk user.created webhook on every event delivery.
 */
export async function ensureSchoolCustomPack(
  ownerUserId: string,
): Promise<string> {
  const [inserted] = await db
    .insert(curriculumPacks)
    .values({
      slug: SCHOOL_CUSTOM_SLUG,
      name: 'School (custom)',
      description: 'Weekly characters input by the parent from school class.',
      isPublic: false,
      ownerUserId,
    })
    .onConflictDoNothing({
      target: [curriculumPacks.slug, curriculumPacks.ownerUserId],
    })
    .returning({ id: curriculumPacks.id });

  if (inserted) return inserted.id;

  const [existing] = await db
    .select({ id: curriculumPacks.id })
    .from(curriculumPacks)
    .where(
      and(
        eq(curriculumPacks.slug, SCHOOL_CUSTOM_SLUG),
        eq(curriculumPacks.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(
      `ensureSchoolCustomPack: insert skipped but no existing row for ${ownerUserId}`,
    );
  }
  return existing.id;
}

export async function getPackById(
  id: string,
): Promise<CurriculumPackRow | undefined> {
  const [row] = await db
    .select()
    .from(curriculumPacks)
    .where(eq(curriculumPacks.id, id))
    .limit(1);
  return row;
}

export interface ChildEnrollmentSummary {
  childId: string;
  pack: CurriculumPackRow | null;
  publishedWeeks: number;
  totalWeeks: number;
}

/**
 * For each child, look up which curriculum_pack they're enrolled in (if any)
 * and how many of the pack's shared weeks are already `published` (= playable).
 */
export async function listChildEnrollmentSummaries(
  childIds: string[],
): Promise<ChildEnrollmentSummary[]> {
  if (childIds.length === 0) return [];

  // For now we just iterate — the dataset is tiny (1-3 children per parent).
  const results: ChildEnrollmentSummary[] = [];
  for (const childId of childIds) {
    const [child] = await db
      .select({ packId: childProfiles.currentCurriculumPackId })
      .from(childProfiles)
      .where(eq(childProfiles.id, childId))
      .limit(1);

    if (!child?.packId) {
      results.push({
        childId,
        pack: null,
        publishedWeeks: 0,
        totalWeeks: 0,
      });
      continue;
    }

    const [pack] = await db
      .select()
      .from(curriculumPacks)
      .where(eq(curriculumPacks.id, child.packId))
      .limit(1);

    const counts = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${weeks.status} = 'published')::int`,
      })
      .from(weeks)
      .where(
        and(eq(weeks.curriculumPackId, child.packId), isNull(weeks.childId)),
      );

    results.push({
      childId,
      pack: pack ?? null,
      publishedWeeks: counts[0]?.published ?? 0,
      totalWeeks: counts[0]?.total ?? 0,
    });
  }
  return results;
}
