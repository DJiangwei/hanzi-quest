/**
 * One-shot data migration: enroll every child under a given parent in a
 * shared curriculum_pack, and drop any stale per-family weeks they may have
 * accumulated from earlier hand-testing.
 *
 * Usage:
 *   pnpm tsx scripts/bind-yinuo-to-pirate-class.ts
 *
 * Default targets banbanhu4ever@gmail.com (David's account) and the
 * `pirate-class-level-1` pack. Override via PARENT_EMAIL / PACK_SLUG env.
 *
 * Idempotent: safe to re-run; SELECTs the targets first and no-ops if
 * already aligned. Filename kept (Yinuo-specific) for git history clarity
 * even though the script is now name-agnostic.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

const PARENT_EMAIL = process.env.PARENT_EMAIL ?? 'banbanhu4ever@gmail.com';
const PACK_SLUG = process.env.PACK_SLUG ?? 'pirate-class-level-1';

async function main() {
  const { and, eq, inArray, isNotNull, isNull } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { childProfiles, curriculumPacks, users, weeks } = await import(
    '../src/db/schema'
  );

  console.log(`[bind] parent=${PARENT_EMAIL} pack=${PACK_SLUG}`);
  const [parent] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, PARENT_EMAIL))
    .limit(1);
  if (!parent) {
    console.error(`[bind] parent ${PARENT_EMAIL} not found`);
    process.exit(1);
  }

  const [pack] = await db
    .select({ id: curriculumPacks.id, name: curriculumPacks.name })
    .from(curriculumPacks)
    .where(
      and(
        eq(curriculumPacks.slug, PACK_SLUG),
        isNull(curriculumPacks.ownerUserId),
      ),
    )
    .limit(1);
  if (!pack) {
    console.error(`[bind] pack ${PACK_SLUG} not found — run seed first`);
    process.exit(1);
  }

  const childRows = await db
    .select({ id: childProfiles.id, displayName: childProfiles.displayName })
    .from(childProfiles)
    .where(eq(childProfiles.parentUserId, parent.id));
  if (childRows.length === 0) {
    console.log('[bind] parent has no children, nothing to enroll');
    process.exit(0);
  }
  console.log(
    '[bind] children:',
    childRows.map((c) => c.displayName),
  );

  const childIds = childRows.map((c) => c.id);

  await db
    .update(childProfiles)
    .set({ currentCurriculumPackId: pack.id })
    .where(inArray(childProfiles.id, childIds));
  console.log(`[bind] ✓ enrolled ${childIds.length} child(ren) in ${pack.name}`);

  const stale = await db
    .select({ id: weeks.id, label: weeks.label })
    .from(weeks)
    .where(
      and(inArray(weeks.childId, childIds), isNotNull(weeks.parentUserId)),
    );
  if (stale.length === 0) {
    console.log('[bind] no stale per-family weeks');
  } else {
    console.log(
      `[bind] deleting ${stale.length} stale per-family week(s):`,
      stale.map((w) => w.label),
    );
    await db
      .delete(weeks)
      .where(
        and(inArray(weeks.childId, childIds), isNotNull(weeks.parentUserId)),
      );
    console.log('[bind] ✓ cleanup done');
  }

  console.log('\n[bind] all set.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
