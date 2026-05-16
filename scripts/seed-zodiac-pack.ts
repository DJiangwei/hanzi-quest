// scripts/seed-zodiac-pack.ts
import 'dotenv/config';
// Also load .env.local (Next.js convention) so DATABASE_URL is available.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set in env');
  }
  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems, sceneTemplates } = await import(
    '../src/db/schema'
  );
  const { eq } = await import('drizzle-orm');

  // 1. Upsert the zodiac pack (slug-unique).
  const [pack] = await db
    .insert(collectionPacks)
    .values({
      slug: 'zodiac-v1',
      name: '十二生肖',
      description: 'Twelve animals of the Chinese zodiac',
      themeColor: '#f5c537',
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const packRow = pack ?? (
    await db
      .select()
      .from(collectionPacks)
      .where(eq(collectionPacks.slug, 'zodiac-v1'))
      .limit(1)
  )[0];

  if (!packRow) throw new Error('Failed to upsert zodiac pack');

  // 2. Insert 12 collectible items (idempotent — pack_id + slug unique together
  //    isn't enforced by schema, so we check existence first).
  const ZODIAC = [
    { slug: 'rat',     nameZh: '鼠', nameEn: 'Rat',     loreZh: '小小的，跑得快。',     loreEn: 'Tiny but quick.' },
    { slug: 'ox',      nameZh: '牛', nameEn: 'Ox',      loreZh: '力气大，耐心好。',     loreEn: 'Strong and patient.' },
    { slug: 'tiger',   nameZh: '虎', nameEn: 'Tiger',   loreZh: '森林里最有威风。',     loreEn: 'King of the forest.' },
    { slug: 'rabbit',  nameZh: '兔', nameEn: 'Rabbit',  loreZh: '毛茸茸，跳得高。',     loreEn: 'Fluffy and bouncy.' },
    { slug: 'dragon',  nameZh: '龙', nameEn: 'Dragon',  loreZh: '天上飞的神兽。',       loreEn: 'Mythical sky dragon.' },
    { slug: 'snake',   nameZh: '蛇', nameEn: 'Snake',   loreZh: '悄悄地游过草地。',     loreEn: 'Slithers through grass.' },
    { slug: 'horse',   nameZh: '马', nameEn: 'Horse',   loreZh: '草原上跑得快。',       loreEn: 'Runs across plains.' },
    { slug: 'sheep',   nameZh: '羊', nameEn: 'Sheep',   loreZh: '云一样的羊毛。',       loreEn: 'Wool like clouds.' },
    { slug: 'monkey',  nameZh: '猴', nameEn: 'Monkey',  loreZh: '顽皮又聪明。',         loreEn: 'Playful and clever.' },
    { slug: 'rooster', nameZh: '鸡', nameEn: 'Rooster', loreZh: '早晨第一个起床。',     loreEn: 'First up at dawn.' },
    { slug: 'dog',     nameZh: '狗', nameEn: 'Dog',     loreZh: '我们的好朋友。',       loreEn: 'Our best friend.' },
    { slug: 'pig',     nameZh: '猪', nameEn: 'Pig',     loreZh: '圆圆的，爱吃。',       loreEn: 'Round and hungry.' },
  ];

  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, packRow.id));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const toInsert = ZODIAC.filter((z) => !existingSlugs.has(z.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((z) => ({
        packId: packRow.id,
        slug: z.slug,
        nameZh: z.nameZh,
        nameEn: z.nameEn,
        loreZh: z.loreZh,
        loreEn: z.loreEn,
        rarity: 'common' as const,
        dropWeight: 1,
        imageUrl: null,
      })),
    );
  }

  // 3. Upsert boss scene_template.
  //    scene_templates has no unique constraint on (type, version), only an index.
  //    Use check-first then insert-if-missing for idempotency.
  const [existingBossTemplate] = await db
    .select({ id: sceneTemplates.id })
    .from(sceneTemplates)
    .where(eq(sceneTemplates.type, 'boss'))
    .limit(1);

  if (!existingBossTemplate) {
    await db.insert(sceneTemplates).values({
      type: 'boss',
      version: 1,
      defaultConfig: {},
      isActive: true,
    });
  }

  console.log(`seeded zodiac pack: ${ZODIAC.length} items, ${toInsert.length} newly inserted`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
