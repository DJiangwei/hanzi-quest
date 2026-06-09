/**
 * Read-only audit of collectible-card art backfill progress.
 *
 * Reports, per target pack (sea-creatures / dinosaurs / solar-system /
 * landmarks), how many `collectible_items.image_url` values are real http(s)
 * URLs vs. still emoji glyphs. Used by the Codex art backfill handoff
 * (`docs/codex-collectible-art-backfill.md`) to confirm completion.
 *
 * Mirrors scripts/verify-image-url-column.ts. NEVER mutates.
 *
 * Run: pnpm tsx scripts/verify-collectible-images.ts
 */
import { config } from 'dotenv';

const TARGET_PACK_SLUGS = [
  'sea-creatures-v1',
  'dinosaurs-v1',
  'solar-system-v1',
  'landmarks-v1',
];

async function main() {
  config({ path: '.env.local' });
  const { db } = await import('@/db');
  const { collectionPacks, collectibleItems } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');

  const packs = await db
    .select()
    .from(collectionPacks)
    .where(inArray(collectionPacks.slug, TARGET_PACK_SLUGS));

  let total = 0;
  let done = 0;
  console.log('\nCollectible art backfill progress:\n');
  for (const slug of TARGET_PACK_SLUGS) {
    const pack = packs.find((p) => p.slug === slug);
    if (!pack) {
      console.log(`⚠️  ${slug.padEnd(18)} pack not found`);
      continue;
    }
    const items = await db
      .select()
      .from(collectibleItems)
      .where(eq(collectibleItems.packId, pack.id));
    const real = items.filter(
      (i) => i.imageUrl && /^https?:\/\//i.test(i.imageUrl),
    ).length;
    const remaining = items.length - real;
    total += items.length;
    done += real;
    const mark = remaining === 0 ? '✅' : '⏳';
    console.log(
      `${mark} ${slug.padEnd(18)} ${String(real).padStart(3)}/${String(items.length).padStart(3)} real images, ${remaining} remaining`,
    );
  }
  console.log(
    `\nTOTAL: ${done}/${total} real images, ${total - done} remaining.\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
