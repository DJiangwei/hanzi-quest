import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('no DATABASE_URL');
  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems, shopItems } = await import(
    '../src/db/schema'
  );
  const { eq, count } = await import('drizzle-orm');

  console.log('=== collection_packs (all rows) ===');
  const allPacks = await db.select().from(collectionPacks);
  for (const p of allPacks) {
    const [{ value: itemCount }] = await db
      .select({ value: count() })
      .from(collectibleItems)
      .where(eq(collectibleItems.packId, p.id));
    console.log(
      `  ${p.slug.padEnd(20)} isActive=${p.isActive}  items=${itemCount}  name="${p.name}"`,
    );
  }
  console.log(`  total packs: ${allPacks.length}`);

  console.log('\n=== shop_items (all rows) by kind + isActive ===');
  const items = await db.select().from(shopItems);
  const byKind: Record<string, { active: number; inactive: number }> = {};
  for (const it of items) {
    byKind[it.kind] ??= { active: 0, inactive: 0 };
    if (it.isActive) byKind[it.kind].active++;
    else byKind[it.kind].inactive++;
  }
  for (const [kind, n] of Object.entries(byKind)) {
    console.log(`  ${kind.padEnd(14)} active=${n.active} inactive=${n.inactive}`);
  }
  console.log(`  total shop items: ${items.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
