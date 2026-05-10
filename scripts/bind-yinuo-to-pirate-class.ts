/**
 * One-shot data migration: bind Yinuo's child_profile to the seeded
 * 海盗班 Level 1 pack and clean up stale per-family Lesson 1 rows from
 * David's earlier hand-testing.
 *
 * Usage:
 *   pnpm tsx scripts/bind-yinuo-to-pirate-class.ts
 *
 * Idempotent — safe to re-run; SELECTs the targets first and no-ops if
 * already aligned.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

const PARENT_EMAIL = 'banbanhu4ever@gmail.com';
const CHILD_NAME = 'Yinuo';
const PACK_SLUG = 'pirate-class-level-1';

async function main() {
  const { and, eq, isNotNull, isNull } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { childProfiles, curriculumPacks, users, weeks } = await import(
    '../src/db/schema'
  );

  console.log('[bind] looking up parent…');
  const [parent] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, PARENT_EMAIL))
    .limit(1);
  if (!parent) {
    console.error(`[bind] parent ${PARENT_EMAIL} not found`);
    process.exit(1);
  }

  console.log('[bind] looking up child…');
  const [child] = await db
    .select({ id: childProfiles.id, currentPack: childProfiles.currentCurriculumPackId })
    .from(childProfiles)
    .where(
      and(
        eq(childProfiles.parentUserId, parent.id),
        eq(childProfiles.displayName, CHILD_NAME),
      ),
    )
    .limit(1);
  if (!child) {
    console.error(`[bind] child ${CHILD_NAME} not found under parent`);
    process.exit(1);
  }

  console.log('[bind] looking up pack…');
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

  // Set enrollment
  if (child.currentPack === pack.id) {
    console.log(`[bind] already enrolled in ${pack.name}, skipping update`);
  } else {
    await db
      .update(childProfiles)
      .set({ currentCurriculumPackId: pack.id })
      .where(eq(childProfiles.id, child.id));
    console.log(`[bind] ✓ enrolled child in ${pack.name}`);
  }

  // Drop David's old per-family Lesson 1 weeks (and their compiled levels via cascade).
  // Per-family weeks have parent_user_id IS NOT NULL.
  const stale = await db
    .select({ id: weeks.id, label: weeks.label })
    .from(weeks)
    .where(
      and(eq(weeks.childId, child.id), isNotNull(weeks.parentUserId)),
    );
  if (stale.length === 0) {
    console.log('[bind] no stale per-family weeks for this child');
  } else {
    console.log(
      `[bind] deleting ${stale.length} per-family week(s) for cleanup:`,
      stale.map((w) => w.label),
    );
    for (const w of stale) {
      await db.delete(weeks).where(eq(weeks.id, w.id));
    }
    console.log('[bind] ✓ cleanup done');
  }

  console.log('\n[bind] all set.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
