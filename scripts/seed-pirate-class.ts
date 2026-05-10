/**
 * Seed the shared 海盗班 (Pirate Class) Level 1 curriculum.
 *
 * Usage:
 *   pnpm tsx scripts/seed-pirate-class.ts
 *
 * Idempotent: re-running re-uses the existing pack + week ids and only
 * regenerates AI content for weeks still in 'draft'.
 *
 * Wall time: ~30 minutes serial (10 weeks × ~3 min/week DeepSeek call).
 * Cost: ~$0.05 against DeepSeek.
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

const PACK_SLUG = 'pirate-class-level-1';
const PACK_NAME = '海盗班 Level 1';
const PACK_DESCRIPTION =
  'Giggling Panda Pirate 字卡 LEVEL 1 — 10 lessons of weekly characters used by Yinuo\'s weekend 汉字班.';

const LESSONS: Array<{ label: string; characters: string[] }> = [
  { label: 'Lesson 1', characters: ['人', '口', '大', '中', '小', '哭', '笑', '一', '上', '下'] },
  { label: 'Lesson 2', characters: ['爸', '天', '太', '月', '二', '妈', '土', '阳', '亮', '星'] },
  { label: 'Lesson 3', characters: ['云', '火', '水', '三', '我', '地', '山', '石', '木', '好'] },
  { label: 'Lesson 4', characters: ['有', '田', '牛', '羊', '四', '聪', '耳', '目', '心', '和'] },
  { label: 'Lesson 5', characters: ['日', '头', '眉', '鼻', '草', '手', '花', '树', '五', '叶'] },
  { label: 'Lesson 6', characters: ['雨', '的', '孩', '六', '明', '白', '红', '是', '家', '风'] },
  { label: 'Lesson 7', characters: ['多', '唱', '子', '七', '歌', '爱', '爷', '奶', '少', '不'] },
  { label: 'Lesson 8', characters: ['宝', '在', '学', '书', '朋', '游', '友', '儿', '贝', '八'] },
  { label: 'Lesson 9', characters: ['九', '生', '习', '看', '戏', '字', '气', '会'] },
  { label: 'Lesson 10', characters: ['十', '见', '雪', '早', '绿', '黄', '青', '鸡'] },
];

async function main() {
  // Dynamic imports — these touch process.env at top level, so we have to
  // load .env.local first.
  const { and, eq, isNull } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { curriculumPacks, weekCharacters, weeks: weeksTable } = await import(
    '../src/db/schema'
  );
  const { generateWeekContent } = await import(
    '../src/lib/ai/generate-content'
  );
  const { linkWeekCharacters, upsertSimplifiedCharacter } = await import(
    '../src/lib/db/characters'
  );
  const { setWeekStatus } = await import('../src/lib/db/weeks');
  const { compileWeekIntoLevels } = await import(
    '../src/lib/scenes/compile-week'
  );

  console.log('[seed] starting…');

  // 1. Ensure pack
  const [existingPack] = await db
    .select({ id: curriculumPacks.id })
    .from(curriculumPacks)
    .where(
      and(
        eq(curriculumPacks.slug, PACK_SLUG),
        isNull(curriculumPacks.ownerUserId),
      ),
    )
    .limit(1);

  let packId: string;
  if (existingPack) {
    packId = existingPack.id;
    console.log(`[seed] pack already exists: ${packId}`);
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
    console.log(`[seed] created pack: ${packId}`);
  }

  // 2. Each lesson
  for (let i = 0; i < LESSONS.length; i++) {
    const lesson = LESSONS[i];
    const weekNumber = i + 1;
    console.log(
      `\n[seed] === ${lesson.label} (${lesson.characters.length} chars) ===`,
    );

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
    console.log(`[seed] week.id=${weekId} status=${status}`);

    if (status === 'published') {
      console.log('[seed] already published, skipping');
      continue;
    }

    // Ensure chars are linked
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
      console.log(`[seed] linked ${lesson.characters.length} chars`);
    }

    if (status !== 'awaiting_review') {
      console.log('[seed] running AI gen…');
      await setWeekStatus(weekId, 'ai_generating');
      try {
        await generateWeekContent({
          weekId,
          parentUserId: null,
          childAge: 6,
          weekLabel: lesson.label,
          characters: lesson.characters,
        });
      } catch (err) {
        console.error(`[seed] gen failed: ${err}`);
        throw err;
      }
    }

    console.log('[seed] compiling levels + publishing…');
    await compileWeekIntoLevels(weekId);
    await db
      .update(weeksTable)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(weeksTable.id, weekId));
    console.log('[seed] ✓ published');
  }

  console.log('\n[seed] done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
