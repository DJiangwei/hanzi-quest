/**
 * Backfill trophies for existing children based on historical play data.
 * Idempotent — re-runs grant no duplicates (PK + onConflictDoNothing).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-trophies.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if .env.local
 * points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

async function main() {
  const { db } = await import('../src/db');
  const { childProfiles } = await import('../src/db/schema');
  const { checkAndGrantTrophies } = await import('../src/lib/db/trophies');
  const { isPerfectWeekForChild } = await import('../src/lib/db/play');

  const kids = await db.select({ id: childProfiles.id }).from(childProfiles);
  console.log(`Found ${kids.length} children. Backfilling trophies…`);

  let totalGranted = 0;
  for (const { id: childId } of kids) {
    const granted: string[] = [];

    // Mastery + streak + level + coins all roll up via the same checks.
    const sets = [
      await checkAndGrantTrophies(childId, { kind: 'level-complete' }),
      await checkAndGrantTrophies(childId, { kind: 'coin-award' }),
    ];

    // Boss-clear (trigger once; the evaluator counts distinct weeks)
    sets.push(await checkAndGrantTrophies(childId, { kind: 'boss-clear', weekId: '' }));

    // Per-pack completion
    for (const packSlug of ['zodiac-v1', 'flags-v1', 'sea-creatures-v1', 'dinosaurs-v1', 'solar-system-v1']) {
      sets.push(await checkAndGrantTrophies(childId, { kind: 'pack-complete', packSlug }));
    }

    // Sound theme (read current setting)
    const { getChildSettings } = await import('../src/lib/db/settings');
    const settings = await getChildSettings(childId);
    if (settings?.soundThemeSlug && settings.soundThemeSlug !== 'default') {
      sets.push(await checkAndGrantTrophies(childId, { kind: 'sound-theme-equip', slug: settings.soundThemeSlug }));
    }

    // Per-scene-type first clears (sweep historical sceneAttempts with score >= 100)
    const { sceneAttempts, weekLevels, sceneTemplates, playSessions } = await import('../src/db/schema');
    const { and, eq, sql } = await import('drizzle-orm');
    const firstClears = await db
      .select({ sceneType: sceneTemplates.type })
      .from(sceneAttempts)
      .innerJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
      .innerJoin(weekLevels, eq(weekLevels.id, sceneAttempts.weekLevelId))
      .innerJoin(sceneTemplates, eq(sceneTemplates.id, weekLevels.sceneTemplateId))
      .where(and(eq(playSessions.childId, childId), sql`${sceneAttempts.score} >= 100`));
    const seenTypes = new Set(firstClears.map((r) => r.sceneType));
    for (const t of ['pinyin_pick', 'translate_pick', 'sentence_cloze']) {
      if (seenTypes.has(t as never)) {
        sets.push(await checkAndGrantTrophies(childId, { kind: 'scene-clear', sceneType: t, score: 100 }));
      }
    }

    // Perfect-week sweep over all weeks the child has played
    const playedWeeks = await db
      .selectDistinct({ weekId: weekLevels.weekId })
      .from(sceneAttempts)
      .innerJoin(playSessions, eq(playSessions.id, sceneAttempts.sessionId))
      .innerJoin(weekLevels, eq(weekLevels.id, sceneAttempts.weekLevelId))
      .where(eq(playSessions.childId, childId));
    for (const { weekId } of playedWeeks) {
      if (await isPerfectWeekForChild(childId, weekId)) {
        sets.push(await checkAndGrantTrophies(childId, { kind: 'perfect-week', weekId }));
      }
    }

    for (const set of sets) for (const t of set) granted.push(t.slug);
    if (granted.length > 0) {
      console.log(`  ${childId}: +${granted.length} (${granted.join(', ')})`);
      totalGranted += granted.length;
    }
  }
  console.log(`Done. Granted ${totalGranted} trophies across ${kids.length} children.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
