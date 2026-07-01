/**
 * Seed the 海域霸主 / Map Champions reward-only pack (`champions-v1`).
 * gacha_eligible=false (never dropped/swapped cheaply). Idempotent.
 * Usage: pnpm tsx scripts/seed-champions-pack.ts
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');
  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { CHAMPIONS } = await import('../src/lib/collections/championsData');

  const [inserted] = await db
    .insert(collectionPacks)
    .values({
      slug: 'champions-v1',
      name: '海域霸主',
      description: 'Earned by defeating each map final boss.',
      themeColor: '#e8a93a',
      isActive: true,
      gachaEligible: false,
    })
    .onConflictDoNothing()
    .returning();
  const pack =
    inserted ??
    (
      await db
        .select()
        .from(collectionPacks)
        .where(eq(collectionPacks.slug, 'champions-v1'))
        .limit(1)
    )[0];
  if (!pack) throw new Error('Failed to upsert champions pack');

  // Ensure an existing pack row is gacha-excluded (in case it predated the flag).
  await db
    .update(collectionPacks)
    .set({ gachaEligible: false })
    .where(eq(collectionPacks.id, pack.id));

  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, pack.id));
  const have = new Set(existing.map((e) => e.slug));
  const toInsert = CHAMPIONS.filter((c) => !have.has(c.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((c) => ({
        packId: pack.id,
        slug: c.slug,
        nameZh: c.nameZh,
        nameEn: c.nameEn,
        loreZh: c.loreZh,
        loreEn: c.loreEn,
        rarity: 'epic' as const,
        dropWeight: 1,
        // image_url left NULL — CardArt renders the emoji glyph until CF-flux art lands.
      })),
    );
  }
  console.log(`seeded champions-v1: ${CHAMPIONS.length} cards, ${toInsert.length} new`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
