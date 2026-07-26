/**
 * Seed the 钥匙宝库 / Key Vault reward-only pack (`key-vault-v1`).
 * gacha_eligible=false — never dropped, never in the weekly 大礼包; earned only
 * by collecting every 🗝️ key on a map (all its weekly bosses beaten).
 * Idempotent. Usage: pnpm tsx scripts/seed-key-vault-pack.ts
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
  const { VAULT_TREASURES, KEY_VAULT_PACK_SLUG } = await import(
    '../src/lib/collections/keyVaultData'
  );

  const [inserted] = await db
    .insert(collectionPacks)
    .values({
      slug: KEY_VAULT_PACK_SLUG,
      name: '钥匙宝库',
      description: 'Opened by collecting every key shard on a map.',
      themeColor: '#10b981',
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
        .where(eq(collectionPacks.slug, KEY_VAULT_PACK_SLUG))
        .limit(1)
    )[0];
  if (!pack) throw new Error('Failed to upsert key-vault pack');

  // Ensure an existing row stays gacha-excluded (in case it predated the flag).
  await db
    .update(collectionPacks)
    .set({ gachaEligible: false })
    .where(eq(collectionPacks.id, pack.id));

  const existing = await db
    .select({ slug: collectibleItems.slug })
    .from(collectibleItems)
    .where(eq(collectibleItems.packId, pack.id));
  const have = new Set(existing.map((e) => e.slug));
  const toInsert = VAULT_TREASURES.filter((t) => !have.has(t.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((t) => ({
        packId: pack.id,
        slug: t.slug,
        nameZh: t.nameZh,
        nameEn: t.nameEn,
        loreZh: t.loreZh,
        loreEn: t.loreEn,
        // 'epic' is the top of the rarity enum (no 'legendary' value exists).
        rarity: 'epic' as const,
        dropWeight: 1,
        // image_url left NULL — CardArt renders the emoji glyph until art lands.
      })),
    );
  }
  console.log(
    `seeded ${KEY_VAULT_PACK_SLUG}: ${VAULT_TREASURES.length} cards, ${toInsert.length} new`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
