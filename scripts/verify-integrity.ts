// Read-only data-integrity checks (roadmap C4). Catches the "seed script not
// run post-merge" / "code and DB drifted" class that unit tests structurally
// miss (they mock @/db). Run ad-hoc pre-release, against whichever DB
// DATABASE_URL points at (dev by default post-C1; swap to PROD_ for prod).
//
// Usage: pnpm tsx scripts/verify-integrity.ts   → PASS/FAIL report, exit 1 on any FAIL.
import { config as loadEnv } from 'dotenv';

interface Check {
  name: string;
  failures: string[];
}

async function main() {
  loadEnv({ path: '.env.local' });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const host = new URL(process.env.DATABASE_URL).hostname.split('.')[0];
  console.log(`Integrity checks against ${host}\n`);

  // Dynamic imports AFTER env load (hard rule #5). Registry/catalog modules
  // hold React components — tsx handles them fine in a script context.
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const { PACK_REGISTRY } = await import('../src/lib/collections/packRegistry');
  const { TROPHIES } = await import('./seed-trophies');
  const { rewardItems } = await import('../src/lib/avatar/itemCatalog');
  const { AVATAR_SLOT_IDS } = await import('../src/lib/avatar/defaultLook');
  const { SHARD_SWAP_EXCLUSIVE_PACKS } = await import('../src/lib/economy/shards');

  const checks: Check[] = [];
  const run = async (name: string, fn: () => Promise<string[]>) => {
    try {
      checks.push({ name, failures: await fn() });
    } catch (err) {
      checks.push({ name, failures: [`check threw: ${String(err).slice(0, 200)}`] });
    }
  };

  // 1. Every active DB pack has UI meta (missing meta crashes the pack page).
  await run('active packs ⊆ PACK_REGISTRY', async () => {
    const rows = await sql<{ slug: string }[]>`SELECT slug FROM collection_packs WHERE is_active = true`;
    return rows.filter((r) => !PACK_REGISTRY[r.slug]).map((r) => `pack '${r.slug}' has no PACK_REGISTRY entry`);
  });

  // 2. Every registry entry has a seeded pack with items.
  await run('PACK_REGISTRY ⊆ seeded packs (with items)', async () => {
    const rows = await sql<{ slug: string; n: string }[]>`
      SELECT p.slug, count(i.id) AS n FROM collection_packs p
      LEFT JOIN collectible_items i ON i.pack_id = p.id GROUP BY p.slug`;
    const bySlug = new Map(rows.map((r) => [r.slug, Number(r.n)]));
    return Object.keys(PACK_REGISTRY)
      .filter((slug) => !bySlug.has(slug) || bySlug.get(slug) === 0)
      .map((slug) => `registry pack '${slug}' missing from DB or has 0 items (seed script not run?)`);
  });

  // 3. avatar_slots covers AVATAR_SLOT_IDS (the PR #59 seed-drift class).
  await run('AVATAR_SLOT_IDS ⊆ avatar_slots', async () => {
    const rows = await sql<{ id: string }[]>`SELECT id FROM avatar_slots`;
    const dbSlots = new Set(rows.map((r) => r.id));
    return AVATAR_SLOT_IDS.filter((s: string) => !dbSlots.has(s)).map(
      (s) => `slot '${s}' missing from avatar_slots (run seed-shop-avatar-items.ts)`,
    );
  });

  // 4. Every TROPHIES seed slug exists in the trophies table (a granted slug
  //    with no row silently grants nothing).
  await run('TROPHIES seed ⊆ trophies table', async () => {
    const rows = await sql<{ slug: string }[]>`SELECT slug FROM trophies`;
    const dbSlugs = new Set(rows.map((r) => r.slug));
    return TROPHIES.filter((t: { slug: string }) => !dbSlugs.has(t.slug)).map(
      (t: { slug: string }) => `trophy '${t.slug}' not seeded (run seed-trophies.ts)`,
    );
  });

  // 5. Every reward-only cosmetic (festival/continent/season/champion) is seeded.
  await run('rewardItems() ⊆ avatar_items', async () => {
    const rows = await sql<{ unlock_ref: string }[]>`SELECT unlock_ref FROM avatar_items`;
    const dbRefs = new Set(rows.map((r) => r.unlock_ref));
    return rewardItems()
      .filter((i: { unlockRef: string }) => !dbRefs.has(i.unlockRef))
      .map((i: { unlockRef: string }) => `reward cosmetic '${i.unlockRef}' not seeded (run seed-festival-avatar-items.ts)`);
  });

  // 6. Shard-exclusive set ⟺ gacha_eligible=false (keep-aligned landmine).
  await run('SHARD_SWAP_EXCLUSIVE_PACKS ⟺ gacha_eligible=false', async () => {
    const rows = await sql<{ slug: string; gacha_eligible: boolean }[]>`
      SELECT slug, gacha_eligible FROM collection_packs WHERE is_active = true`;
    const failures: string[] = [];
    for (const r of rows) {
      const exclusive = SHARD_SWAP_EXCLUSIVE_PACKS.has(r.slug);
      // champions-v1 is reward-only but priced via the exclusive set too; any
      // reward-only pack NOT in the exclusive set is cheaply swappable — flag it.
      if (!r.gacha_eligible && !exclusive) failures.push(`reward-only pack '${r.slug}' missing from SHARD_SWAP_EXCLUSIVE_PACKS`);
      if (r.gacha_eligible && exclusive) failures.push(`'${r.slug}' is in SHARD_SWAP_EXCLUSIVE_PACKS but gacha_eligible=true`);
    }
    return failures;
  });

  // 7. Content sanity: words that should have art but don't.
  await run('words with image_hook have image_url', async () => {
    const rows = await sql<{ n: string }[]>`
      SELECT count(*) AS n FROM words WHERE image_hook IS NOT NULL AND image_url IS NULL`;
    const n = Number(rows[0].n);
    return n > 0 ? [`${n} words have image_hook but NULL image_url (authoring image-gen failed?)`] : [];
  });

  await sql.end();

  let failed = 0;
  for (const c of checks) {
    if (c.failures.length === 0) {
      console.log(`✅ ${c.name}`);
    } else {
      failed++;
      console.log(`❌ ${c.name}`);
      for (const f of c.failures) console.log(`   - ${f}`);
    }
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
