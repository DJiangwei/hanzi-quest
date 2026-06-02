/**
 * One-shot data migration: enroll every existing child with
 * `current_curriculum_pack_id IS NULL` into the default shared pack
 * (`pirate-class-level-1` / Caribbean Sea), so they immediately see
 * the universal game content.
 *
 * Usage:
 *   pnpm tsx scripts/bind-existing-children-to-default-pack.ts
 *
 * Idempotent: only updates rows that have NULL pack; safe to re-run.
 *
 * Default pack slug is `pirate-class-level-1`. Override via PACK_SLUG env.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

const PACK_SLUG = process.env.PACK_SLUG ?? 'pirate-class-level-1';

async function main() {
  const { and, eq, isNull } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { childProfiles, curriculumPacks } = await import(
    '../src/db/schema'
  );

  console.log(`[bind-default] pack=${PACK_SLUG}`);
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
    console.error(`[bind-default] pack ${PACK_SLUG} not found — run seed first`);
    process.exit(1);
  }

  const pending = await db
    .select({
      id: childProfiles.id,
      displayName: childProfiles.displayName,
    })
    .from(childProfiles)
    .where(isNull(childProfiles.currentCurriculumPackId));

  if (pending.length === 0) {
    console.log('[bind-default] no children with NULL pack — nothing to do');
    process.exit(0);
  }

  console.log(
    `[bind-default] enrolling ${pending.length} child(ren) in ${pack.name}:`,
    pending.map((c) => c.displayName),
  );

  await db
    .update(childProfiles)
    .set({ currentCurriculumPackId: pack.id })
    .where(isNull(childProfiles.currentCurriculumPackId));

  console.log('[bind-default] ✓ done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
