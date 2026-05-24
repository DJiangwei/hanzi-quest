/**
 * One-off: flip the pinyin_pick scene_template row to is_active=false.
 * Idempotent — re-running is safe.
 *
 * Usage:
 *   pnpm tsx scripts/disable-pinyin-pick.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
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
  const { sceneTemplates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const result = await db
    .update(sceneTemplates)
    .set({ isActive: false })
    .where(eq(sceneTemplates.type, 'pinyin_pick'))
    .returning({ id: sceneTemplates.id, isActive: sceneTemplates.isActive });

  if (result.length === 0) {
    console.log('No pinyin_pick scene_template found — nothing to do.');
  } else {
    for (const r of result) {
      console.log(`  pinyin_pick template ${r.id} → is_active=${r.isActive}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
