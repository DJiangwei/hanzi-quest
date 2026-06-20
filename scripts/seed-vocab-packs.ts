/**
 * Seed the 4 themed vocab packs (transport / minibeasts / instruments / animals).
 * Idempotent: upserts each pack by slug (active, gacha_eligible=true) and inserts
 * only missing collectible_items. Emoji stored verbatim in image_url as the text
 * fallback (overwritten later by the CF art generator).
 *
 * Usage: pnpm tsx scripts/seed-vocab-packs.ts
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

interface SeedItem { slug: string; nameZh: string; nameEn: string; emoji: string; loreZh: string; loreEn: string; }
interface SeedPack { slug: string; name: string; description: string; themeColor: string; items: SeedItem[]; }

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');

  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { TRANSPORT } = await import('../src/lib/collections/transportData');
  const { MINIBEASTS } = await import('../src/lib/collections/minibeastsData');
  const { INSTRUMENTS } = await import('../src/lib/collections/instrumentsData');
  const { ANIMALS } = await import('../src/lib/collections/animalsData');

  const packs: SeedPack[] = [
    { slug: 'transport-v1', name: '交通工具', description: 'Things that go on land, water, and air.', themeColor: '#e8562a', items: TRANSPORT },
    { slug: 'minibeasts-v1', name: '昆虫', description: 'Little bug friends from the garden.', themeColor: '#3fae5a', items: MINIBEASTS },
    { slug: 'instruments-v1', name: '乐器', description: 'Western and Chinese instruments.', themeColor: '#8b5cf6', items: INSTRUMENTS },
    { slug: 'animals-v1', name: '动物', description: 'Pets, woodland, and zoo animals.', themeColor: '#e8893a', items: ANIMALS },
  ];

  for (const p of packs) {
    const [inserted] = await db
      .insert(collectionPacks)
      .values({ slug: p.slug, name: p.name, description: p.description, themeColor: p.themeColor, isActive: true, gachaEligible: true })
      .onConflictDoNothing()
      .returning();
    const packRow = inserted ?? (await db.select().from(collectionPacks).where(eq(collectionPacks.slug, p.slug)).limit(1))[0];
    if (!packRow) throw new Error(`Failed to upsert pack ${p.slug}`);

    const existing = await db.select({ slug: collectibleItems.slug }).from(collectibleItems).where(eq(collectibleItems.packId, packRow.id));
    const existingSlugs = new Set(existing.map((e) => e.slug));
    const toInsert = p.items.filter((i) => !existingSlugs.has(i.slug));
    if (toInsert.length > 0) {
      await db.insert(collectibleItems).values(
        toInsert.map((i) => ({
          packId: packRow.id,
          slug: i.slug,
          nameZh: i.nameZh,
          nameEn: i.nameEn,
          loreZh: i.loreZh,
          loreEn: i.loreEn,
          imageUrl: i.emoji,
        })),
      );
    }
    console.log(`seeded ${p.slug}: ${p.items.length} items, ${toInsert.length} new`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
