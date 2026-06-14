/**
 * Seed the shared 海盗班 (Pirate Class) Level 2 — Map 2 / 印度洋 (Indian Ocean).
 *
 * IDENTICAL pipeline to Map 1 (`seed-pirate-class.ts`): same AI scene-gen, same
 * `compileWeekIntoLevels`, same scene-design logic — only the pack + the LESSONS
 * differ. The compile + scene-gen code is pack-agnostic, so Map 2 plays exactly
 * like Map 1.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * TO AUTHOR MAP 2: paste David's 10 weeks of characters into `LESSONS` below
 * (one entry per week, each a list of hanzi — same shape as Map 1), then run:
 *
 *   pnpm tsx scripts/seed-pirate-class-2.ts            # AI-gen + compile + publish
 *   pnpm tsx scripts/backfill-word-images-cloudflare.ts  # fill word pictures (CF)
 *
 * Map 2 auto-unlocks on /maps the moment its first week is published
 * (isLocked = weekCount === 0). No code change needed to unlock.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Idempotent: re-running re-uses the existing pack + week ids and only
 * regenerates AI content for weeks still in 'draft'. Wall time ~30 min serial
 * (10 weeks × ~3 min/week DeepSeek). Cost ~$0.05 DeepSeek.
 */

import { config as loadEnv } from 'dotenv';

// MUST load env BEFORE importing anything that touches process.env.DATABASE_URL.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY not set in .env.local');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

const PACK_SLUG = 'pirate-class-level-2';
const PACK_NAME = '海盗班 Level 2';
const PACK_DESCRIPTION =
  'Giggling Panda Pirate 字卡 LEVEL 2 — 印度洋 / Indian Ocean, 10 weekly lessons.';

// ── FILL ME ─────────────────────────────────────────────────────────────────
// One entry per week. Each `characters` is the week's hanzi (8–10 per week,
// same as Map 1). Example of the exact shape (from Map 1):
//   { label: 'Lesson 1', characters: ['人', '口', '大', '中', '小', ...] },
// Leave empty until David provides the 10 weeks — the guard below refuses to run.
const LESSONS: Array<{ label: string; characters: string[] }> = [
  // { label: 'Lesson 1',  characters: [/* … */] },
  // { label: 'Lesson 2',  characters: [/* … */] },
  // … 10 weeks …
];
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (LESSONS.length === 0) {
    console.error(
      '[seed:map2] LESSONS is empty — paste the 10 weeks of characters into ' +
        'scripts/seed-pirate-class-2.ts before running. Aborting (nothing changed).',
    );
    process.exit(0);
  }

  const { and, eq, isNull } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { curriculumPacks, weekCharacters, weeks: weeksTable } = await import(
    '../src/db/schema'
  );
  const { generateWeekContent } = await import('../src/lib/ai/generate-content');
  const { linkWeekCharacters, upsertSimplifiedCharacter } = await import(
    '../src/lib/db/characters'
  );
  const { setWeekStatus } = await import('../src/lib/db/weeks');
  const { compileWeekIntoLevels } = await import('../src/lib/scenes/compile-week');

  console.log(`[seed:map2] starting… ${LESSONS.length} weeks`);

  // 1. Ensure pack (the 印度洋 placeholder already exists — reuse it).
  const [existingPack] = await db
    .select({ id: curriculumPacks.id })
    .from(curriculumPacks)
    .where(and(eq(curriculumPacks.slug, PACK_SLUG), isNull(curriculumPacks.ownerUserId)))
    .limit(1);

  let packId: string;
  if (existingPack) {
    packId = existingPack.id;
    console.log(`[seed:map2] pack already exists: ${packId}`);
  } else {
    const [created] = await db
      .insert(curriculumPacks)
      .values({
        slug: PACK_SLUG,
        name: PACK_NAME,
        description: PACK_DESCRIPTION,
        isPublic: true,
        ownerUserId: null,
      })
      .returning({ id: curriculumPacks.id });
    packId = created.id;
    console.log(`[seed:map2] created pack: ${packId}`);
  }

  // 2. Each lesson — same flow as Map 1.
  for (let i = 0; i < LESSONS.length; i++) {
    const lesson = LESSONS[i];
    const weekNumber = i + 1;
    console.log(`\n[seed:map2] === ${lesson.label} (${lesson.characters.length} chars) ===`);

    const [existingWeek] = await db
      .select({ id: weeksTable.id, status: weeksTable.status })
      .from(weeksTable)
      .where(
        and(
          eq(weeksTable.curriculumPackId, packId),
          eq(weeksTable.weekNumber, weekNumber),
          isNull(weeksTable.childId),
        ),
      )
      .limit(1);

    let weekId: string;
    let status: string;
    if (existingWeek) {
      weekId = existingWeek.id;
      status = existingWeek.status;
    } else {
      const [created] = await db
        .insert(weeksTable)
        .values({
          parentUserId: null,
          childId: null,
          curriculumPackId: packId,
          weekNumber,
          label: lesson.label,
          status: 'draft',
        })
        .returning({ id: weeksTable.id, status: weeksTable.status });
      weekId = created.id;
      status = created.status;
    }
    console.log(`[seed:map2] week.id=${weekId} status=${status}`);

    if (status === 'published') {
      console.log('[seed:map2] already published, skipping');
      continue;
    }

    const existingLinks = await db
      .select({ characterId: weekCharacters.characterId })
      .from(weekCharacters)
      .where(eq(weekCharacters.weekId, weekId));
    if (existingLinks.length !== lesson.characters.length) {
      await db.transaction(async (tx) => {
        const pairs: Array<{ characterId: string; position: number }> = [];
        for (let j = 0; j < lesson.characters.length; j++) {
          const charRow = await upsertSimplifiedCharacter(tx, {
            hanzi: lesson.characters[j],
            pinyinArray: [],
            createdByUserId: null,
          });
          pairs.push({ characterId: charRow.id, position: j });
        }
        await linkWeekCharacters(tx, weekId, pairs);
      });
      console.log(`[seed:map2] linked ${lesson.characters.length} chars`);
    }

    if (status !== 'awaiting_review') {
      console.log('[seed:map2] running AI gen…');
      await setWeekStatus(weekId, 'ai_generating');
      await generateWeekContent({
        weekId,
        parentUserId: null,
        childAge: 6,
        weekLabel: lesson.label,
        characters: lesson.characters,
      });
    }

    console.log('[seed:map2] compiling levels + publishing…');
    await compileWeekIntoLevels(weekId);
    await db
      .update(weeksTable)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(weeksTable.id, weekId));
    console.log('[seed:map2] ✓ published');
  }

  console.log('\n[seed:map2] done. Run scripts/backfill-word-images-cloudflare.ts next for pictures.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
