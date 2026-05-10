import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { curriculumPacks } from '@/db/schema';

export const SCHOOL_CUSTOM_SLUG = 'school-custom';

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
